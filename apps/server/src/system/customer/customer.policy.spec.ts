import { AuthorizationContext } from "#/processor/authorization/authorization-context.js";
import { CustomerStatus } from "#/generated/prisma/enums.js";
import {
  CUSTOMER_HIGH_VALUE_THRESHOLD,
  CustomerPolicy,
  type CustomerPolicyRecord,
} from "./customer.policy.js";

const customer = (
  overrides: Partial<CustomerPolicyRecord> = {},
): CustomerPolicyRecord => ({
  id: "customer-1",
  status: CustomerStatus.LEAD,
  dealAmount: "99999.99",
  confidential: false,
  ownerId: "user-1",
  departmentId: "dept-1",
  ...overrides,
});

const context = (
  permissions: string[],
  code = "customer:view",
  grant: {
    all: boolean;
    scopes: Array<{ type: "SELF" } | { type: "DEPARTMENT"; ids: string[] }>;
  } = {
    all: false,
    scopes: [],
  },
) =>
  new AuthorizationContext(
    "user-1",
    permissions,
    Object.fromEntries(
      [
        ...new Set([
          code,
          ...permissions.filter((permission) =>
            ["view", "detail", "add", "update", "delete", "export"].some(
              (action) => permission === `customer:${action}`,
            ),
          ),
        ]),
      ].map((permission) => [permission, { scoped: true as const, grant }]),
    ),
  );

describe("CustomerPolicy", () => {
  it("exports the inclusive high-value threshold", () => {
    expect(CUSTOMER_HIGH_VALUE_THRESHOLD).toBe(100000);
  });

  it.each([
    [{ all: false, scopes: [] }, { id: { in: [] } }],
    [
      { all: false, scopes: [{ type: "SELF" as const }] },
      { OR: [{ ownerId: "user-1" }] },
    ],
    [
      {
        all: false,
        scopes: [{ type: "DEPARTMENT" as const, ids: ["dept-2", "dept-1"] }],
      },
      { OR: [{ departmentId: { in: ["dept-2", "dept-1"] } }] },
    ],
    [{ all: true, scopes: [] }, {}],
  ])("maps each data grant to explicit Prisma where", (grant, expected) => {
    expect(
      new CustomerPolicy(
        context(["customer:view"], "customer:view", grant),
      ).whereFor("customer:view"),
    ).toEqual(expected);
  });

  it("ANDs scope and confidentiality so business OR cannot bypass either", () => {
    const policy = new CustomerPolicy(
      context(["customer:view"], "customer:view", {
        all: false,
        scopes: [{ type: "SELF" }, { type: "DEPARTMENT", ids: ["dept-2"] }],
      }),
    );

    expect(
      policy.queryWhere("customer:view", {
        OR: [{ name: { contains: "A" } }, { phone: { contains: "A" } }],
      }),
    ).toEqual({
      AND: [
        { OR: [{ ownerId: "user-1" }, { departmentId: { in: ["dept-2"] } }] },
        { confidential: false },
        { OR: [{ name: { contains: "A" } }, { phone: { contains: "A" } }] },
      ],
    });
  });

  it("lets sensitive readers see confidential rows and strips internalCost otherwise", () => {
    const normal = new CustomerPolicy(
      context(["customer:view"], "customer:view", { all: true, scopes: [] }),
    );
    const sensitive = new CustomerPolicy(
      context(["customer:view", "customer:sensitive-view"], "customer:view", {
        all: true,
        scopes: [],
      }),
    );

    expect(normal.queryWhere("customer:view", {})).toEqual({
      AND: [{}, { confidential: false }, {}],
    });
    expect(
      normal.project(customer({ confidential: false }), []),
    ).not.toHaveProperty("internalCost");
    expect(
      sensitive.project({ ...customer(), internalCost: "42.00" }, []),
    ).toHaveProperty("internalCost", "42.00");
  });

  it("enforces high-value boundary, frozen deny and WON delete exception in memory", () => {
    const policy = new CustomerPolicy(
      context(["customer:update", "customer:delete"], "customer:update", {
        all: true,
        scopes: [],
      }),
    );

    expect(policy.can("update", customer({ dealAmount: "99999.99" }))).toBe(
      true,
    );
    expect(
      policy.can(
        "update",
        customer({ dealAmount: String(CUSTOMER_HIGH_VALUE_THRESHOLD) }),
      ),
    ).toBe(false);
    expect(
      policy.can("update", customer({ status: CustomerStatus.FROZEN })),
    ).toBe(false);
    expect(policy.can("delete", customer({ status: CustomerStatus.WON }))).toBe(
      false,
    );
  });

  it("explicit deny wins but wildcard super admin bypasses frozen and exceptional checks", () => {
    const elevated = new CustomerPolicy(
      context(
        [
          "customer:update",
          "customer:delete",
          "customer:high-value-update",
          "customer:won-delete",
        ],
        "customer:update",
        { all: true, scopes: [] },
      ),
    );
    const superAdmin = new CustomerPolicy(
      context(["*"], "customer:update", { all: true, scopes: [] }),
    );

    expect(
      elevated.can("update", customer({ status: CustomerStatus.FROZEN })),
    ).toBe(false);
    expect(
      superAdmin.can(
        "update",
        customer({ status: CustomerStatus.FROZEN, dealAmount: "999999.00" }),
      ),
    ).toBe(true);
    expect(
      superAdmin.can("delete", customer({ status: CustomerStatus.FROZEN })),
    ).toBe(true);
  });

  it("returns pure in-memory capabilities without a row-level assign flag", () => {
    const policy = new CustomerPolicy(
      context(
        ["customer:update", "customer:delete", "customer:assign"],
        "customer:update",
        { all: true, scopes: [] },
      ),
    );

    expect(policy.capabilities(customer())).toEqual(["update", "delete"]);
    expect(
      policy.capabilities(customer({ status: CustomerStatus.FROZEN })),
    ).toEqual([]);
  });

  it("computes capabilities from each action decision instead of the list decision", () => {
    const policy = new CustomerPolicy(
      new AuthorizationContext(
        "user-1",
        ["customer:view", "customer:update", "customer:delete"],
        {
          "customer:view": { scoped: true, grant: { all: true, scopes: [] } },
          "customer:update": {
            scoped: true,
            grant: { all: false, scopes: [{ type: "SELF" }] },
          },
          "customer:delete": {
            scoped: true,
            grant: {
              all: false,
              scopes: [{ type: "DEPARTMENT", ids: ["dept-2"] }],
            },
          },
        },
      ),
    );

    expect(
      policy.capabilities(
        customer({ ownerId: "other", departmentId: "dept-1" }),
      ),
    ).toEqual([]);
    expect(
      policy.capabilities(
        customer({ ownerId: "user-1", departmentId: "dept-1" }),
      ),
    ).toEqual(["update"]);
    expect(
      policy.capabilities(
        customer({ ownerId: "other", departmentId: "dept-2" }),
      ),
    ).toEqual(["delete"]);
  });

  it("exposes detail from customer:detail grant without mutation attribute limits", () => {
    const policy = new CustomerPolicy(
      new AuthorizationContext("user-1", ["customer:view", "customer:detail"], {
        "customer:view": { scoped: true, grant: { all: true, scopes: [] } },
        "customer:detail": {
          scoped: true,
          grant: { all: false, scopes: [{ type: "SELF" }] },
        },
      }),
    );
    const frozenOwn = customer({
      status: CustomerStatus.FROZEN,
      ownerId: "user-1",
    });
    const others = customer({ ownerId: "other", departmentId: "dept-1" });

    expect(policy.can("detail", frozenOwn)).toBe(true);
    expect(policy.capabilities(frozenOwn)).toEqual(["detail"]);
    expect(policy.can("detail", others)).toBe(false);
    expect(policy.capabilities(others)).toEqual([]);
  });
});
