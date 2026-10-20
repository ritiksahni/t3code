import { MessageId, RunId } from "@t3tools/contracts";
import { describe, expect, it, vi } from "vite-plus/test";

import { AppAtomRegistryProvider } from "~/rpc/atomRegistry";
import { act, render } from "../../../test/render";
import { openRevertConfirm, RevertConfirmHost } from "./ChatOverlayHosts";

const messageId = MessageId.make("message-1");
const messageRunId = RunId.make("message-run-1");
const activeRunId = RunId.make("active-run-2");
const pending = (turnCount: number, interruptRunId: RunId | null = null) => ({
  turnCount,
  messageId,
  messageRunId,
  interruptRunId,
});
const dialog = () => document.querySelector('[role="alertdialog"]');

describe("RevertConfirmHost", () => {
  it("shows only its thread's request, confirms it once, and drops it when the thread changes", async () => {
    const onConfirm = vi.fn();
    const host = (threadKey: string) => (
      <AppAtomRegistryProvider>
        <RevertConfirmHost threadKey={threadKey} onConfirm={onConfirm} />
      </AppAtomRegistryProvider>
    );
    await using screen = await render(host("env:a"));

    await act(() => openRevertConfirm("env:b", pending(2)));
    expect(dialog()).toBeNull();

    await act(() => openRevertConfirm("env:a", pending(2)));
    const keep = [...(dialog()?.querySelectorAll("button") ?? [])].find(
      (button) => button.textContent === "Revert and keep changes",
    );
    await act(() => keep?.click());
    expect(onConfirm).toHaveBeenCalledExactlyOnceWith(pending(2), false);
    await vi.waitFor(() => expect(dialog()).toBeNull());

    await act(() => openRevertConfirm("env:a", pending(3)));
    expect(dialog()).not.toBeNull();
    await screen.rerender(host("env:b"));
    await vi.waitFor(() => expect(dialog()).toBeNull());
  });

  it("discloses and preserves active work until the user confirms", async () => {
    const onConfirm = vi.fn();
    await using _screen = await render(
      <AppAtomRegistryProvider>
        <RevertConfirmHost threadKey="env:a" onConfirm={onConfirm} />
      </AppAtomRegistryProvider>,
    );

    await act(() => openRevertConfirm("env:a", pending(2, activeRunId)));
    expect(dialog()?.textContent).toContain("Stop the current turn");
    const cancel = [...(dialog()?.querySelectorAll("button") ?? [])].find(
      (button) => button.textContent === "Cancel",
    );
    await act(() => cancel?.click());
    expect(onConfirm).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(dialog()).toBeNull());

    await act(() => openRevertConfirm("env:a", pending(2, activeRunId)));
    const revertFiles = [...(dialog()?.querySelectorAll("button") ?? [])].find(
      (button) => button.textContent === "Revert files too",
    );
    await act(() => revertFiles?.click());
    expect(onConfirm).toHaveBeenCalledExactlyOnceWith(pending(2, activeRunId), true);
  });
});
