export function resolveResponsiveNavigationOpenState(input: {
  isCompactNavigation: boolean;
  previousCompactNavigation: boolean;
  previousNavigationOpen: boolean;
}): boolean {
  if (!input.isCompactNavigation) {
    return true;
  }

  if (!input.previousCompactNavigation) {
    return false;
  }

  return input.previousNavigationOpen;
}
