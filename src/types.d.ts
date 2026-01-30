declare module 'virtual:tailwind-config' {
    export const colors: Record<string, string | Record<string, string>>;
}

declare const __GIT_COMMIT_HASH__: string;

declare module '@3d-dice/dice-box' {
  interface DiceBoxConfig {
    assetPath?: string;
    container?: string;
    theme?: string;
    themeColor?: string;
    scale?: number;
    gravity?: number;
    throwForce?: number;
    spinForce?: number;
    settleTimeout?: number;
    offscreen?: boolean;
  }
  interface DiceResult {
    groupId: number;
    rollId: number;
    sides: number;
    theme: string;
    themeColor: string;
    value: number;
  }
  interface RollGroup {
    id: number;
    qty: number;
    sides: number;
    value: number;
    rolls: DiceResult[];
  }
  export default class DiceBox {
    constructor(config?: DiceBoxConfig);
    init(): Promise<void>;
    roll(notation: string | string[]): Promise<RollGroup[]>;
    add(notation: string | string[]): Promise<RollGroup[]>;
    clear(): void;
    hide(): void;
    show(): void;
    resizeWorld(): void;
    onRollComplete: ((results: RollGroup[]) => void) | null;
    onDieComplete: ((result: DiceResult) => void) | null;
  }
}
