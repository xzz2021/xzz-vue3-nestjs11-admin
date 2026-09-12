import { FilterXSS } from "xss";

/** 富文本标签白名单：与前端 wangEditor 的产出能力对齐 */
const BLOCK_ATTRS = ["style"];
const CELL_ATTRS = ["colspan", "rowspan", "width", "style"];

const richTextFilter = new FilterXSS({
  whiteList: {
    p: BLOCK_ATTRS,
    div: BLOCK_ATTRS,
    span: BLOCK_ATTRS,
    br: [],
    hr: [],
    strong: BLOCK_ATTRS,
    b: BLOCK_ATTRS,
    em: BLOCK_ATTRS,
    i: BLOCK_ATTRS,
    u: BLOCK_ATTRS,
    s: BLOCK_ATTRS,
    sub: [],
    sup: [],
    code: BLOCK_ATTRS,
    pre: BLOCK_ATTRS,
    blockquote: BLOCK_ATTRS,
    h1: BLOCK_ATTRS,
    h2: BLOCK_ATTRS,
    h3: BLOCK_ATTRS,
    h4: BLOCK_ATTRS,
    h5: BLOCK_ATTRS,
    ul: BLOCK_ATTRS,
    ol: BLOCK_ATTRS,
    li: BLOCK_ATTRS,
    a: ["href", "target", "rel"],
    img: ["src", "alt", "width", "height", "style"],
    table: BLOCK_ATTRS,
    thead: [],
    tbody: [],
    tr: BLOCK_ATTRS,
    th: CELL_ATTRS,
    td: CELL_ATTRS,
    colgroup: [],
    col: ["width", "style"],
  },
  // 未在白名单内的标签整体丢弃，script/style 连内容一起丢弃
  stripIgnoreTag: true,
  stripIgnoreTagBody: ["script", "style"],
  css: {
    whiteList: {
      color: true,
      "background-color": true,
      "text-align": true,
      "font-size": true,
      "font-weight": true,
      "font-style": true,
      "line-height": true,
      "text-decoration": true,
      width: true,
      height: true,
    },
  },
});

const plainTextFilter = new FilterXSS({
  whiteList: {},
  stripIgnoreTag: true,
  stripIgnoreTagBody: ["script", "style"],
});

/** 非文本但仍有展示意义的标签，判断内容是否为空时需要计入 */
const VISIBLE_EMPTY_TAG_REGEX = /<(img|hr|table)\b/i;

/**
 * 清洗用户提交的富文本，移除脚本、事件属性、危险协议等 XSS 载荷。
 * 落库前统一调用，保证所有消费端（列表、WS 推送、后续渠道）拿到的都是安全内容。
 */
export const sanitizeRichText = (html: string): string =>
  richTextFilter.process(html);

/** 富文本是否没有任何可见内容（仅空段落、空白字符等） */
export const isRichTextEmpty = (html: string): boolean => {
  if (VISIBLE_EMPTY_TAG_REGEX.test(html)) return false;
  return (
    plainTextFilter
      .process(html)
      .replace(/&nbsp;|\u00a0/g, " ")
      .trim().length === 0
  );
};
