import { z } from "zod";

export const userStatusValues = ["active", "inactive", "suspended"] as const;

export const userFormSchema = z.object({
  name: z.string().min(1, "Il nome è obbligatorio").max(255),
  email: z.email({ message: "Inserisci un indirizzo email valido" }),
  company_name: z.string().max(255).optional().or(z.literal("")),
  status: z.enum(userStatusValues),
  notes: z.string().max(1000).optional().or(z.literal("")),
  group_ids: z.array(z.string()).optional(),
});

export type UserFormValues = z.infer<typeof userFormSchema>;

export const groupFormSchema = z.object({
  name: z.string().min(1, "Il nome è obbligatorio").max(100),
  description: z.string().max(500).optional().or(z.literal("")),
});

export type GroupFormValues = z.infer<typeof groupFormSchema>;
