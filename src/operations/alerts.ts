import { z } from "zod";
import { TenderlyClient } from "../client/tenderly.js";
import { GetAlertsResponseSchema, GetAlertResponseSchema } from "../schemas.js";

export async function listAlerts(client: TenderlyClient) {
  try {
    const response = await client.request<z.infer<typeof GetAlertsResponseSchema>>("/alerts");
    const validatedResponse = GetAlertsResponseSchema.parse(response);
    return validatedResponse.alerts;
  } catch (error) {
    console.error("Error fetching alerts:", error);
    throw error;
  }
}

export async function getAlertById(client: TenderlyClient, alertId: string) {
  try {
    const response = await client.request<z.infer<typeof GetAlertResponseSchema>>(`/alert/${alertId}`);
    const validatedResponse = GetAlertResponseSchema.parse(response);
    return validatedResponse.alert;
  } catch (error) {
    console.error("Error fetching alert by ID:", error);
    throw error;
  }
} 