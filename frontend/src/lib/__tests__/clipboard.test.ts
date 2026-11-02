import { afterEach, describe, it, expect, vi } from "vitest";
import { copyText } from "../clipboard";
afterEach(() => vi.unstubAllGlobals());
function dom(allowed = true) {
  const field = {
      value: "",
      readOnly: false,
      style: { cssText: "" },
      select: vi.fn(),
      remove: vi.fn(),
    },
    focus = vi.fn(),
    exec = vi.fn(() => allowed),
    append = vi.fn();
  vi.stubGlobal("document", {
    activeElement: { focus },
    getSelection: () => null,
    createElement: () => field,
    body: { appendChild: append },
    execCommand: exec,
  });
  return { field, focus, exec, append };
}
describe("LAN clipboard", () => {
  it("uses the secure clipboard when available", async () => {
    const d = dom(),
      writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    await copyText("/PROG TEST");
    expect(writeText).toHaveBeenCalledWith("/PROG TEST");
    expect(d.exec).not.toHaveBeenCalled();
  });
  it("copies on HTTP without Clipboard API and removes its temporary field", async () => {
    const d = dom();
    vi.stubGlobal("navigator", {});
    await copyText("/PROG TEST");
    expect(d.exec).toHaveBeenCalledWith("copy");
    expect(d.field.value).toBe("/PROG TEST");
    expect(d.field.remove).toHaveBeenCalled();
    expect(d.focus).toHaveBeenCalled();
  });
  it("cleans up and reports refusal when browser disallows both paths", async () => {
    const d = dom(false);
    vi.stubGlobal("navigator", {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
    });
    await expect(copyText("text")).rejects.toThrow("手动复制");
    expect(d.field.remove).toHaveBeenCalled();
    expect(d.focus).toHaveBeenCalled();
  });
});
