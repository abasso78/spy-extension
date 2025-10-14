declare module 'uuid' {
  export function v4(): string;
  export function v5(): string;
  // Minimal declarations - other UUID helpers are not used in this project.
  const uuid: {
    v4: typeof v4;
    v5: typeof v5;
  };
  export default uuid;
}
