import { describe, it, expect, vi, afterEach } from "vitest";
import { withTimeout } from "./timeout";

describe("withTimeout", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves when promise completes before timeout", async () => {
    const result = await withTimeout(Promise.resolve("ok"), 1000);
    expect(result).toBe("ok");
  });

  it("rejects when promise takes longer than timeout", async () => {
    vi.useFakeTimers();
    const slow = new Promise((resolve) => setTimeout(resolve, 20_000));
    const promise = withTimeout(slow, 100, "test call");

    vi.advanceTimersByTime(100);

    await expect(promise).rejects.toThrow("test call timed out after 100ms");
  });

  it("uses default 15s timeout", async () => {
    vi.useFakeTimers();
    const slow = new Promise((resolve) => setTimeout(resolve, 30_000));
    const promise = withTimeout(slow);

    vi.advanceTimersByTime(15_000);

    await expect(promise).rejects.toThrow("timed out after 15000ms");
  });

  it("rejects when original promise rejects", async () => {
    await expect(withTimeout(Promise.reject(new Error("fail")), 1000)).rejects.toThrow("fail");
  });
});
