let seq = 0;

export function debugLog(prefix, message, data = null) {
  const time = new Date().toISOString().split("T")[1];
  seq++;

  if (data !== null) {
    console.log(
      `%c[${prefix}] #${seq} ${time} → ${message}`,
      "color:#00d4ff;font-weight:bold",
      data
    );
  } else {
    console.log(
      `%c[${prefix}] #${seq} ${time} → ${message}`,
      "color:#00d4ff;font-weight:bold"
    );
  }
}

export function debugGroup(prefix, label) {
  console.group(`%c[${prefix}] ${label}`, "color:#ffaa00;font-weight:bold");
}

export function debugGroupEnd() {
  console.groupEnd();
}
