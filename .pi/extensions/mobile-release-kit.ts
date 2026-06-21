// Pi extension for Mobile Release Kit — registers the repo's skills/ with Pi.
// Pi loads SKILL.md folders from the path below; content is shared with every
// other harness (no duplication).
export const extension = {
  name: "mobile-release-kit",
  description:
    "Ship Expo/RN apps to the App Store & Play Store: screenshot capture, device-frame rendering, EAS release runbooks.",
  skillsDir: "../../skills",
};
export default extension;
