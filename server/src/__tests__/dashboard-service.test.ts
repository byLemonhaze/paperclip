import { describe, expect, it, vi } from "vitest";
import { dashboardService } from "../services/dashboard.ts";

function createSelectChain(result: unknown, withGroupBy = false) {
  const where = vi.fn(() => (withGroupBy ? { groupBy: vi.fn(async () => result) } : Promise.resolve(result)));
  return { from: vi.fn(() => ({ where })) };
}

function createDbStub({
  companyRows,
  agentRows,
  taskRows,
  approvalRows,
  costRows,
}: {
  companyRows: unknown;
  agentRows: unknown;
  taskRows: unknown;
  approvalRows: unknown;
  costRows: unknown;
}) {
  const chains = [
    createSelectChain(companyRows),
    createSelectChain(agentRows, true),
    createSelectChain(taskRows, true),
    createSelectChain(approvalRows),
    createSelectChain(costRows),
  ];

  return {
    select: vi.fn(() => {
      const chain = chains.shift();
      if (!chain) throw new Error("Unexpected db.select() call");
      return chain;
    }),
  };
}

describe("dashboardService.summary", () => {
  it("ignores malformed aggregate rows instead of crashing", async () => {
    const db = createDbStub({
      companyRows: [{ id: "company-1", budgetMonthlyCents: 1000 }],
      agentRows: [undefined, { status: "idle", count: "2" }, { status: "running", count: undefined }],
      taskRows: [undefined, { status: "todo", count: "3" }, { status: undefined, count: "8" }],
      approvalRows: [undefined],
      costRows: [undefined],
    });

    const summary = await dashboardService(db as any).summary("company-1");

    expect(summary).toEqual({
      companyId: "company-1",
      agents: {
        active: 2,
        running: 0,
        paused: 0,
        error: 0,
      },
      tasks: {
        open: 3,
        inProgress: 0,
        blocked: 0,
        done: 0,
      },
      costs: {
        monthSpendCents: 0,
        monthBudgetCents: 1000,
        monthUtilizationPercent: 0,
      },
      pendingApprovals: 0,
    });
  });
});
