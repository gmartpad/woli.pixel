import { renderHook } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { useClickOutside } from "./useClickOutside";

describe("useClickOutside", () => {
  it("calls handler when clicking outside the referenced element", () => {
    const handler = vi.fn();
    const { result } = renderHook(() => useClickOutside<HTMLDivElement>(handler));

    const inside = document.createElement("div");
    const outside = document.createElement("div");
    document.body.appendChild(inside);
    document.body.appendChild(outside);

    // Attach ref to the "inside" element
    Object.defineProperty(result.current, "current", {
      value: inside,
      writable: true,
    });

    // Click outside
    outside.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    expect(handler).toHaveBeenCalledTimes(1);

    document.body.removeChild(inside);
    document.body.removeChild(outside);
  });

  it("does NOT call handler when clicking inside the referenced element", () => {
    const handler = vi.fn();
    const { result } = renderHook(() => useClickOutside<HTMLDivElement>(handler));

    const inside = document.createElement("div");
    document.body.appendChild(inside);

    Object.defineProperty(result.current, "current", {
      value: inside,
      writable: true,
    });

    // Click inside
    inside.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    expect(handler).not.toHaveBeenCalled();

    document.body.removeChild(inside);
  });

  it("cleans up event listener on unmount", () => {
    const handler = vi.fn();
    const removeSpy = vi.spyOn(document, "removeEventListener");

    const { unmount } = renderHook(() => useClickOutside<HTMLDivElement>(handler));
    unmount();

    expect(removeSpy).toHaveBeenCalledWith("mousedown", expect.any(Function));
    removeSpy.mockRestore();
  });
});
