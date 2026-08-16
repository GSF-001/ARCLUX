export interface AttackSurfaceMapper { map(files: string[]): string[]; }
export function createAttackSurfaceMapper(): AttackSurfaceMapper { return { map: (files) => files.filter((file) => /route|controller|handler|api/i.test(file)) }; }
