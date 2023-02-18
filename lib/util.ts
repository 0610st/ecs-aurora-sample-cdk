export const createResourceName = (systemName: string, envType: string, originalName: string) => {
  return `${systemName}-${envType}-${originalName}`;
};
