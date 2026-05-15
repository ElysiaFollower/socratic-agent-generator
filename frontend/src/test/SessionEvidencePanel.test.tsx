import {describe, expect, it} from "vitest";
import {
  cleanShellTranscript,
  formatAuditTranscript,
  lineColor,
  panelWidthBounds,
} from "../components/session/SessionEvidencePanel";
import {RemoteCommandAudit} from "../types";

describe("SessionEvidencePanel helpers", () => {
  it("caps shell width to about 70 percent of the container", () => {
    expect(panelWidthBounds(1200)).toEqual({min: 360, max: 840});
    expect(panelWidthBounds(1600)).toEqual({min: 360, max: 1120});
  });

  it("formats audit fallback like a lightweight shell transcript", () => {
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

    const transcript = formatAuditTranscript(audit);

    expect(transcript).toContain("/home/seed/lab $ pwd");
    expect(transcript).toContain("/home/seed/lab");
    expect(transcript).not.toContain("# action:");
    expect(transcript).not.toContain("# cwd:");
    expect(transcript).not.toContain("2026-05-14");
    expect(transcript).not.toContain("exit 0");
  });

  it("removes generated audit metadata from remote transcript text", () => {
    expect(
      cleanShellTranscript(
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
    ).toBe("$ pwd\n/home/seed");
  });

  it("keeps real shell prompts highlightable after switching from audit fallback", () => {
    expect(lineColor("bash-5.0$ docker ps")).toBe("#9cdcfe");
    expect(lineColor("seed@lab:/tmp# tcpdump -i eth0")).toBe("#9cdcfe");
    expect(lineColor("/home/seed/lab $ pwd")).toBe("#9cdcfe");
  });

  it("strips Remote Runner source wrappers from real shell transcripts", () => {
    expect(
      cleanShellTranscript(
        [
          "bash-5.0$ source /home/seed/.remote-runner/commands/cmd_1/run.sh __REMOTE_RUNNER_CMD_BEGIN_cmd_1__ uid=1001(seed)",
          "__REMOTE_RUNNER_CMD_END_cmd_1__:0",
          "bash-5.0$ docker ps",
        ].join("\n"),
      ),
    ).toBe("uid=1001(seed)\nbash-5.0$ docker ps");
  });
});
