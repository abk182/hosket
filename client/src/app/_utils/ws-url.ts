export const getWsUrl = (route: string) => {
  const isHttps =
    typeof window !== "undefined" && window.location.protocol === "https:";
  const defaultHost =
    typeof window !== "undefined"
      ? `${window.location.hostname}:3001`
      : "localhost:3001";
  const host = process.env.NEXT_PUBLIC_WS_HOST || defaultHost;
  return `${isHttps ? "wss" : "ws"}://${host}/ws/${route}`;
};
