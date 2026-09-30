/**
 * Spend confirmation gate.
 *
 * A ready billable provider must be confirmed against the exact idempotency
 * key before the client is allowed to POST. Mock / non-billable work stays
 * one-click. Changing the brief changes the key, so a prior confirmation
 * cannot authorize a different paid run.
 */

export type SpendClick = "submit" | "confirm" | "wait";

export type SpendConfirmationInput = {
  /** True when this click would bill a live provider. */
  billable: boolean;
  /** False until /api/providers has answered for the chosen provider. */
  readinessKnown: boolean;
  currentKey: string;
  confirmedKey: string | null;
};

export function decideSpendClick(input: SpendConfirmationInput): SpendClick {
  if (!input.billable) return "submit";
  if (!input.readinessKnown) return "wait";
  if (input.confirmedKey === input.currentKey) return "submit";
  return "confirm";
}
