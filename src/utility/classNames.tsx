export default function c(
  ...classNames: (string | false | null | undefined)[]
) {
  return classNames.filter((a) => !!a).join(" ");
}
