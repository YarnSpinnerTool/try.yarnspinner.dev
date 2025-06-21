const initialContent: { [key: string]: string } = {
  default: require("./initial-content/Default.yarn"),
  pax: require("./initial-content/PAX2022.yarn"),
  nzgdc24: require("./initial-content/NZGDC24.yarn"),
};

export const getInitialContent = (
  id: string | undefined,
): string | undefined => {
  id ??= "default";
  const data = initialContent[id.toLowerCase()];
  return data;
};
