import {describe, expect, it} from "vitest";
import {
  buildTerminalLines,
  lineColor,
  panelWidthBounds,
} from "../components/session/SessionEvidencePanel";
import {RemoteCommandAudit} from "../types";

describe("SessionEvidencePanel helpers", () => {
  it("caps shell width to about 70 percent of the container", () => {
    expect(panelWidthBounds(1200)).toEqual({min: 360, max: 840});
    expect(panelWidthBounds(1600)).toEqual({min: 360, max: 1120});
  });

  it("normalizes audit records into the same terminal line model", () => {
    const audit: RemoteCommandAudit = {
      audit_id: "audit-1",
      session_id: "session-1",
      terminal_id: "terminal-1",
      action: "session_exec",
      command: "pwd",
      cwd: "/home/seed/lab",
      exit_code: 0,
      stdout_excerpt: "/home/seed/lab\n",
      stderr_excerpt: null,
      error: null,
      create_at: "2026-05-14T14:00:00Z",
    };

    const lines = buildTerminalLines("", [audit]);

    expect(lines).toEqual([
      {kind: "prompt", text: "/home/seed/lab $ pwd"},
      {kind: "output", text: "/home/seed/lab"},
    ]);
  });

  it("normalizes remote transcript text into the same terminal line model", () => {
    expect(
      buildTerminalLines(
        [
          "$ pwd",
          "source /home/seed/.remote-runner/commands/cmd_1/run.sh",
          "__REMOTE_RUNNER_CMD_BEGIN_cmd_1__",
          "# action: session_exec",
          "# cwd: /home/seed",
          "/home/seed",
          "__REMOTE_RUNNER_CMD_END_cmd_1__:0",
          "# exit 0 · 2026/5/14 22:00:00",
        ].join("\n"),
      ),
    ).toEqual([
      {kind: "prompt", text: "$ pwd"},
      {kind: "output", text: "/home/seed"},
    ]);
  });

  it("keeps real shell prompts highlightable after switching from audit fallback", () => {
    expect(
      buildTerminalLines(
        [
          "bash-5.0$ docker ps",
          "seed@lab:/tmp# tcpdump -i eth0",
          "/home/seed/lab $ pwd",
        ].join("\n"),
      ).map((line) => line.kind),
    ).toEqual(["prompt", "prompt", "prompt"]);
    expect(lineColor("prompt")).toBe("#9cdcfe");
  });

  it("strips Remote Runner source wrappers from real shell transcripts", () => {
    expect(
      buildTerminalLines(
        [
          "bash-5.0$ source /home/seed/.remote-runner/commands/cmd_1/run.sh __REMOTE_RUNNER_CMD_BEGIN_cmd_1__ uid=1001(seed)",
          "__REMOTE_RUNNER_CMD_END_cmd_1__:0",
          "bash-5.0$ docker ps",
        ].join("\n"),
        [{
          audit_id: "audit-1",
          session_id: "session-1",
          terminal_id: "terminal-1",
          action: "session_exec",
          command: "id",
          cwd: "",
        }],
      ),
    ).toEqual([
      {kind: "prompt", text: "$ id"},
      {kind: "output", text: "uid=1001(seed)"},
      {kind: "prompt", text: "bash-5.0$ docker ps"},
    ]);
  });
});
