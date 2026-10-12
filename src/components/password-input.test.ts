import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import test from "node:test";
import { LoginForm, RegisterForm } from "@/components/auth-forms";
import { PasswordInput, passwordVisibility } from "@/components/password-input";
import { ResetPasswordForm } from "@/components/password-reset-forms";

test("password visibility starts hidden and flips label, type, and pressed", () => {
  const hidden = passwordVisibility(false);
  assert.equal(hidden.inputType, "password");
  assert.equal(hidden.label, "Show password");
  assert.equal(hidden.pressed, false);

  const shown = passwordVisibility(true);
  assert.equal(shown.inputType, "text");
  assert.equal(shown.label, "Hide password");
  assert.equal(shown.pressed, true);
});

test("each password field renders its own hidden toggle and keeps the form fields", () => {
  const login = renderToStaticMarkup(createElement(LoginForm, { nextPath: "/account", queryError: "" }));
  assert.match(login, /name="password"/);
  assert.match(login, /autoComplete="current-password"|autocomplete="current-password"/);
  assert.match(login, /type="password"/);
  assert.match(login, /type="button"/);
  assert.match(login, /aria-label="Show password"/);
  assert.match(login, /aria-pressed="false"/);
  assert.equal(login.includes("Hide password"), false);
  assert.match(login, /type="submit"/);

  const register = renderToStaticMarkup(createElement(RegisterForm, { nextPath: "/" }));
  assert.match(register, /autoComplete="new-password"|autocomplete="new-password"/);
  assert.match(register, /minLength="8"|minlength="8"/);
  assert.match(register, /aria-label="Show password"/);
  assert.equal(count(register, "aria-label=\"Show password\""), 1);

  const reset = renderToStaticMarkup(createElement(ResetPasswordForm, { token: "t".repeat(24), nextPath: "/" }));
  assert.match(reset, /name="password"/);
  assert.match(reset, /autoComplete="new-password"|autocomplete="new-password"/);
  assert.match(reset, /aria-label="Show password"/);
  assert.equal(count(reset, "type=\"password\""), 1);
});

test("two password fields toggle independently", () => {
  const html = renderToStaticMarkup(
    createElement(
      "form",
      null,
      createElement(PasswordInput, { name: "password", autoComplete: "new-password", required: true }),
      createElement(PasswordInput, { name: "confirm", autoComplete: "new-password", required: true }),
    ),
  );
  assert.equal(count(html, "aria-label=\"Show password\""), 2);
  assert.equal(count(html, "aria-pressed=\"false\""), 2);
  assert.equal(count(html, "type=\"password\""), 2);
  assert.equal(count(html, "type=\"button\""), 2);
  assert.match(html, /name="password"/);
  assert.match(html, /name="confirm"/);
  assert.equal(html.includes("Hide password"), false);
});

function count(html: string, needle: string) {
  return html.split(needle).length - 1;
}
