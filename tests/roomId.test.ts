import { describe, expect, test } from "bun:test";
import { canonicalRoomId, hostStorageKey, roomChannelId } from "../lib/roomId";

describe("room identity", () => {
  test("canonicalizes lowercase and uppercase room codes identically", () => {
    expect(canonicalRoomId("cldfbi")).toBe("CLDFBI");
    expect(canonicalRoomId("CLDFBI")).toBe("CLDFBI");
  });

  test("uses one identity for Portal channels and host storage", () => {
    const lowercase = "cldfbi";
    const uppercase = "CLDFBI";

    expect(roomChannelId(lowercase)).toBe("room:CLDFBI");
    expect(roomChannelId(lowercase)).toBe(roomChannelId(uppercase));
    expect(hostStorageKey(lowercase)).toBe("pinturillo-host:CLDFBI");
    expect(hostStorageKey(lowercase)).toBe(hostStorageKey(uppercase));
  });
});
