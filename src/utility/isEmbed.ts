
export default function isEmbed() {
    const url = window.location;
    if (url.pathname === "/embed") {
        return true;
    } else {
        return false;
    }
}