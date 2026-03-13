#!/usr/bin/env python3
import os
import pty
import select
import sys
import time

INPUT_BYTES = b"ship pnpm test on src/app.ts\r"
EOF_BYTES = b"\x04"
READY_MARKER = b"footprint-smoke-ready"
ASSISTANT_MARKER = b"assistant:ship pnpm test on src/app.ts"
DONE_MARKER = b"done:ship pnpm test on src/app.ts"


def read_available(master_fd: int, output: bytearray) -> bool:
    read_fds, _, _ = select.select([master_fd], [], [], 0.2)
    if master_fd not in read_fds:
        return False

    try:
        chunk = os.read(master_fd, 4096)
    except OSError:
        return False

    if not chunk:
        return False

    output.extend(chunk)
    return True


def drain_remaining_output(master_fd: int, output: bytearray) -> None:
    idle_cycles = 0

    while idle_cycles < 5:
        if read_available(master_fd, output):
            idle_cycles = 0
            continue

        idle_cycles += 1


def main() -> int:
    if len(sys.argv) != 4:
        print(
            "usage: macos-pty-driver.py <node-path> <cli-path> <fixture-path>",
            file=sys.stderr,
        )
        return 2

    node_path, cli_path, fixture_path = sys.argv[1:4]
    child_pid, master_fd = pty.fork()

    if child_pid == 0:
        os.execvpe(
            node_path,
            [
                node_path,
                cli_path,
                "run",
                "claude",
                "--",
                fixture_path,
                "--emit-adapter",
                "--emit-ready",
            ],
            os.environ.copy(),
        )

    output = bytearray()
    exit_status = None
    ready_sent = False
    eof_sent = False

    try:
        deadline = time.time() + 30
        saw_done_marker = False

        while time.time() < deadline:
            read_available(master_fd, output)

            if not ready_sent and READY_MARKER in output:
                os.write(master_fd, INPUT_BYTES)
                ready_sent = True

            if ready_sent and not eof_sent and ASSISTANT_MARKER in output:
                os.write(master_fd, EOF_BYTES)
                eof_sent = True

            if DONE_MARKER in output:
                saw_done_marker = True

            if exit_status is None:
                child_status = os.waitpid(child_pid, os.WNOHANG)
                if child_status[0] == child_pid:
                    exit_status = child_status[1]
                    drain_remaining_output(master_fd, output)
                    saw_done_marker = DONE_MARKER in output
                    break

        if exit_status is None:
            os.kill(child_pid, 15)
            _, exit_status = os.waitpid(child_pid, 0)
            drain_remaining_output(master_fd, output)

        if not ready_sent:
            print(
                "Timed out waiting for macOS PTY smoke readiness marker",
                file=sys.stderr,
            )
            return 1

        if not eof_sent:
            print(
                "Timed out waiting for macOS PTY assistant transcript before EOF",
                file=sys.stderr,
            )
            return 1

        if not saw_done_marker and DONE_MARKER not in output:
            print(
                "Timed out waiting for macOS PTY smoke transcript marker",
                file=sys.stderr,
            )
            return 1

        sys.stdout.buffer.write(bytes(output))
        if os.WIFEXITED(exit_status):
            return os.WEXITSTATUS(exit_status)
        if os.WIFSIGNALED(exit_status):
            return 128 + os.WTERMSIG(exit_status)
        return 1
    finally:
        os.close(master_fd)


if __name__ == "__main__":
    raise SystemExit(main())
