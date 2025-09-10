export const getUrl = (route: string, protocol: 'ws' | 'http') => {
  const isHttps =
    typeof window !== "undefined" && window.location.protocol === "https:";
  const defaultHost =
    typeof window !== "undefined"
      ? `${window.location.hostname}:3000`
      : "localhost:3000";
  const host = process.env.NEXT_PUBLIC_WS_HOST || defaultHost;

  return `${isHttps ? `${protocol}s` : protocol}://${host}/api${protocol === 'ws' ? '/ws' : ''}/${route}`;
};
