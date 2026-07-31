import type { ImportKind } from "../shared/types";

export interface DependencyProps {
  fromModuleId: string;
  toModuleId: string;
  kind: ImportKind;
  isTypeOnly: boolean;
}

export class Dependency {
  readonly fromModuleId: string;
  readonly toModuleId: string;
  readonly kind: ImportKind;
  readonly isTypeOnly: boolean;

  constructor(props: DependencyProps) {
    this.fromModuleId = props.fromModuleId;
    this.toModuleId = props.toModuleId;
    this.kind = props.kind;
    this.isTypeOnly = props.isTypeOnly;
  }

  get isRuntimeDependency(): boolean {
    return !this.isTypeOnly;
  }

  get id(): string {
    return `${this.fromModuleId}->${this.toModuleId}`;
  }
}
