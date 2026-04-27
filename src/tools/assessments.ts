import { z } from "zod/v4";
import { mlflowClient } from "../client.js";
import { assertWriteAllowed } from "./utils.js";

const assessmentSourceSchema = z.object({
  source_type: z.enum(["HUMAN", "LLM_JUDGE", "CODE", "AI_JUDGE"]).describe("Source type for the assessment"),
  source_id: z.string().optional().describe("Identifier of the source (e.g. user email, judge name)"),
});

const traceAssessmentsBase = (traceId: string) =>
  `/api/3.0/mlflow/traces/${encodeURIComponent(traceId)}/assessments`;

// --- log-feedback ---

export const logFeedbackSchema = z.object({
  traceId: z.string().describe("Trace ID this feedback is for"),
  name: z.string().describe("Feedback name (e.g. 'helpfulness')"),
  value: z.union([z.string(), z.number(), z.boolean()]).describe("Feedback value (score, label, etc.)"),
  rationale: z.string().optional().describe("Free-form explanation"),
  source: assessmentSourceSchema.optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export async function logFeedback(params: z.infer<typeof logFeedbackSchema>) {
  assertWriteAllowed();
  return mlflowClient.post(traceAssessmentsBase(params.traceId), {
    assessment: {
      trace_id: params.traceId,
      assessment_name: params.name,
      feedback: { value: params.value },
      rationale: params.rationale,
      source: params.source ?? { source_type: "HUMAN" },
      metadata: params.metadata,
    },
  });
}

// --- log-expectation ---

export const logExpectationSchema = z.object({
  traceId: z.string().describe("Trace ID"),
  name: z.string().describe("Expectation name (e.g. 'expected_answer')"),
  value: z.union([z.string(), z.number(), z.boolean(), z.record(z.string(), z.any())]).describe("Ground-truth value"),
  rationale: z.string().optional(),
  source: assessmentSourceSchema.optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export async function logExpectation(params: z.infer<typeof logExpectationSchema>) {
  assertWriteAllowed();
  return mlflowClient.post(traceAssessmentsBase(params.traceId), {
    assessment: {
      trace_id: params.traceId,
      assessment_name: params.name,
      expectation: { value: params.value },
      rationale: params.rationale,
      source: params.source ?? { source_type: "HUMAN" },
      metadata: params.metadata,
    },
  });
}

// --- get-assessment ---

export const getAssessmentSchema = z.object({
  traceId: z.string(),
  assessmentId: z.string(),
});

export async function getAssessment(params: z.infer<typeof getAssessmentSchema>) {
  return mlflowClient.get(
    `${traceAssessmentsBase(params.traceId)}/${encodeURIComponent(params.assessmentId)}`,
  );
}

// --- update-assessment ---

export const updateAssessmentSchema = z.object({
  traceId: z.string(),
  assessmentId: z.string(),
  value: z.union([z.string(), z.number(), z.boolean(), z.record(z.string(), z.any())]).optional(),
  rationale: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export async function updateAssessment(params: z.infer<typeof updateAssessmentSchema>) {
  assertWriteAllowed();
  const assessment: Record<string, unknown> = {
    assessment_id: params.assessmentId,
    trace_id: params.traceId,
  };
  const paths: string[] = [];
  if (params.rationale !== undefined) {
    assessment.rationale = params.rationale;
    paths.push("rationale");
  }
  if (params.metadata !== undefined) {
    assessment.metadata = params.metadata;
    paths.push("metadata");
  }
  if (params.value !== undefined) {
    assessment.feedback = { value: params.value };
    paths.push("feedback");
  }
  if (paths.length === 0) {
    throw new Error("updateAssessment requires at least one of: value, rationale, metadata");
  }
  return mlflowClient.patch(
    `${traceAssessmentsBase(params.traceId)}/${encodeURIComponent(params.assessmentId)}`,
    { assessment, update_mask: { paths } },
  );
}

// --- delete-assessment ---

export const deleteAssessmentSchema = z.object({
  traceId: z.string(),
  assessmentId: z.string(),
});

export async function deleteAssessment(params: z.infer<typeof deleteAssessmentSchema>) {
  assertWriteAllowed();
  return mlflowClient.delete(
    `${traceAssessmentsBase(params.traceId)}/${encodeURIComponent(params.assessmentId)}`,
  );
}
