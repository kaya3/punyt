declare namespace Assert {
    export class AssertionError extends Error {
    }
    export function fail(message: string, ...args: unknown[]): never;
    export function isTrue(b: boolean, message: string): void;
    export function isFalse(b: boolean, message: string): void;
    export function isNaN(x: number, message: string): void;
    type NoInfer<T> = [T][T extends any ? 0 : never];
    export function equal<T>(x: NoInfer<T>, y: T, message: string): void;
    export function notEqual<T>(x: NoInfer<T>, y: T, message: string): void;
    export function approx(x: number, y: number, epsilon: number, message: string): void;
    export function shallowEqual<T>(x: NoInfer<T>, y: T, message: string): void;
    export function deepEqual<T>(x: NoInfer<T>, y: T, message: string): void;
    export function distinct<T>(arr: readonly T[], message: string): void;
    export function distinctByKey<T>(arr: readonly T[], keyFunc: (x: T) => string | number | bigint, message: string): void;
    export function throws(f: () => void, message: string): void;
    export function throwsLike(f: () => void, errorPredicate: (e: unknown) => boolean, message: string): void;
    export {};
}
declare namespace Punyt {
    type UnitTestClass<K extends string = string> = new () => Record<K, () => void>;
    type UnitTestResult = Readonly<{
        className: string;
        methodName: string;
        result: 'pass' | 'ignored';
    } | {
        className: string;
        methodName: string;
        result: 'fail' | 'error';
        error: unknown;
        stackTrace: string;
    }>;
    interface UnitTestClassResult {
        readonly className: string;
        readonly results: readonly UnitTestResult[];
        readonly count: number;
        readonly pass: number;
        readonly fail: number;
        readonly error: number;
        readonly ignored: number;
    }
    /**
     * Decorator for unit test class methods which should not be run.
     */
    const ignore: MethodDecorator;
    function test<K extends string>(cls: UnitTestClass<K>): void;
    function runAll(): UnitTestClassResult[];
    function runOne(className: string, methodName: string): UnitTestResult;
    function runAllInBrowser(): void;
}
