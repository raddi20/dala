import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import test from "node:test";
import NotFound from "@/app/not-found";
import ErrorPage from "@/app/error";
import { BUSINESS_PHONE_TEL } from "@/lib/public-info";

function assertWaysOut(html: string) {
  assert.match(html, /href="\/"/);
  assert.match(html, /href="\/listings"/);
  assert.match(html, /href="\/contact"/);
  const digits = BUSINESS_PHONE_TEL.replace(/\D/g, "");
  assert.match(html, new RegExp(`href="https://wa\\.me/${digits}"`));
  assert.match(html, /Rangach/);
}

test("the not-found page links home, to listings, and to contact", () => {
  const html = renderToStaticMarkup(createElement(NotFound));
  assert.match(html, /That page is not here/);
  assertWaysOut(html);
  assert.equal(html.includes("min-h-11"), true);
});

test("the error page hides the message and still offers a way out", () => {
  const html = renderToStaticMarkup(
    createElement(ErrorPage, {
      error: Object.assign(new Error("reset failed for grace@dala.local on 0722506974"), { digest: "abc123" }),
      reset: () => undefined,
    }),
  );
  assert.match(html, /Something went wrong/);
  assert.match(html, /Try again/);
  assert.match(html, /Reference abc123/);
  assert.equal(html.includes("grace@dala.local"), false);
  assert.equal(html.includes("0722506974"), false);
  assertWaysOut(html);
});
