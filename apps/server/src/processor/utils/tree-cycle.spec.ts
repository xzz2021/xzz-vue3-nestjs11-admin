import { BadRequestException } from "@nestjs/common";
import { assertAcyclicParent, type ParentLink } from "./tree-cycle.js";

describe("assertAcyclicParent", () => {
  const links: ParentLink[] = [
    { id: "root", parentId: null },
    { id: "child", parentId: "root" },
    { id: "grandchild", parentId: "child" },
    { id: "other", parentId: null },
  ];

  it("allows moving a node under an unrelated branch or root", () => {
    expect(() =>
      assertAcyclicParent(links, "child", "other", "菜单"),
    ).not.toThrow();
    expect(() =>
      assertAcyclicParent(links, "child", null, "菜单"),
    ).not.toThrow();
  });

  it("rejects self-parenting", () => {
    expect(() => assertAcyclicParent(links, "child", "child", "菜单")).toThrow(
      BadRequestException,
    );
  });

  it("rejects moving a node below its descendant", () => {
    expect(() =>
      assertAcyclicParent(links, "root", "grandchild", "部门"),
    ).toThrow("不能将部门移动到自己的后代节点下");
  });

  it("rejects missing parent nodes and pre-existing cycles", () => {
    expect(() =>
      assertAcyclicParent(links, "child", "missing", "部门"),
    ).toThrow("父级部门不存在");

    const cyclicLinks: ParentLink[] = [
      { id: "a", parentId: "b" },
      { id: "b", parentId: "a" },
      { id: "c", parentId: null },
    ];
    expect(() => assertAcyclicParent(cyclicLinks, "c", "a", "菜单")).toThrow(
      "菜单树已存在环",
    );
  });
});
