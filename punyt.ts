namespace Assert {
    function _str(x: unknown): string {
        return typeof x === 'string' ? JSON.stringify(x)
            : typeof x === 'symbol' ? `Symbol(${x.description !== undefined ? "'" + x.description + "'" : ''})`
            : `${x}`;
    }
    
    export class AssertionError extends Error {}
    
    let _failLoggingEnabled = true;
    export function fail(message: string, ...args: unknown[]): never {
        if(_failLoggingEnabled && args.length > 0) {
            console.error(message, ...args);
        }
        throw new AssertionError(message);
    }
    
    export function isTrue(b: boolean, message: string): void {
        if(!b) {
            fail(message);
        }
    }
    
    export function isFalse(b: boolean, message: string): void {
        if(b) {
            fail(message);
        }
    }
    
    export function isNaN(x: number, message: string): void {
        if(x === x) {
            fail(`Expected NaN, was ${x}\n${message}`, x);
        }
    }
    
    // https://github.com/microsoft/TypeScript/issues/14829#issuecomment-504042546
    type NoInfer<T> = [T][T extends any ? 0 : never]
    
    export function equal<T>(x: NoInfer<T>, y: T, message: string): void {
        if(x !== y) {
            fail(`${_str(x)} !== ${_str(y)}\n${message}`, x, y);
        }
    }
    
    export function notEqual<T>(x: NoInfer<T>, y: T, message: string): void {
        if(x === y) {
            fail(`${_str(x)} === ${_str(y)}\n${message}`, x, y);
        }
    }
    
    export function approx(x: number, y: number, epsilon: number, message: string): void {
        if(Math.abs(x - y) >= epsilon) {
            fail(`${x} !== ${y}\n${message}`, x, y);
        }
    }
    
    const equalMembers = function<T>(x: T, y: T, eqTest: <S>(x: S, y: S) => boolean): boolean {
        if(x === y) {
            return true;
        } else if(Array.isArray(x)) {
            return Array.isArray(y) && x.length === y.length && x.every((x_i, i) => eqTest(x_i, y[i]));
        } else if(typeof x === 'object' && typeof y === 'object') {
            if(x === null || y === null) { return false; }
            const xKeys = Object.keys(x).sort() as (keyof T)[];
            const yKeys = Object.keys(y).sort() as (keyof T)[];
            return isShallowEqual(xKeys, yKeys) && xKeys.every(k => eqTest(x[k], y[k]));
        }
        return false;
    };
    const isDirectEqual = <T>(x: T, y: T): boolean => x === y;
    const isShallowEqual = <T>(x: T, y: T): boolean => equalMembers(x, y, isDirectEqual);
    const isDeepEqual = <T>(x: T, y: T): boolean => equalMembers(x, y, isDeepEqual);
    
    export function shallowEqual<T>(x: NoInfer<T>, y: T, message: string): void {
        if(!isShallowEqual(x, y)) {
            fail(`${_str(x)}\n  !== ${_str(y)}\n${message}`, x, y);
        }
    }
    
    export function deepEqual<T>(x: NoInfer<T>, y: T, message: string): void {
        if(!isDeepEqual(x, y)) {
            fail(`${_str(x)}\n  !== ${_str(y)}\n${message}`, x, y);
        }
    }
    
    export function distinct<T>(arr: readonly T[], message: string): void {
        const set = new Set<T>();
        for(const x of arr) {
            if(set.has(x)) {
                fail(`${_str(x)} in [${arr.map(_str).join(', ')}]\n${message}`, x, arr);
            }
            set.add(x);
        }
    }
    
    export function distinctByKey<T>(arr: readonly T[], keyFunc: (x: T) => string | number | bigint, message: string): void {
        const map = new Map<string | number | bigint, T>();
        for(const x of arr) {
            const key = keyFunc(x);
            if(map.has(key)) {
                const y = map.get(key);
                fail(`${_str(y)} and ${_str(x)} share key ${key} in [${arr.map(_str).join(', ')}]\n${message}`, y, x, key, arr);
            }
            map.set(key, x);
        }
    }
    
    export function throws(f: () => void, message: string): void {
        throwsLike(f, () => true, message);
    }
    
    export function throwsLike(f: () => void, errorPredicate: (e: unknown) => boolean, message: string): void {
        const oldLoggingEnabled = _failLoggingEnabled;
        _failLoggingEnabled = false;
        try {
            f();
        } catch(e: unknown) {
            if(errorPredicate(e)) {
                return;
            } else {
                fail(`Exception thrown does not satisfy predicate: ${_str(e)}\n${message}`, e);
            }
        } finally {
            _failLoggingEnabled = oldLoggingEnabled;
        }
        
        fail(`Expected exception, but none was thrown\n${message}`);
    }
}

namespace Punyt {
    export type UnitTestClass<K extends string = string> = new () => Record<K, () => void>
    
    export type UnitTestResult = Readonly<
        | {className: string, methodName: string, result: 'pass' | 'ignored'}
        | {className: string, methodName: string, result: 'fail' | 'error', error: unknown, stackTrace: string}
    >
    
    export interface UnitTestClassResult {
        readonly className: string,
        readonly results: readonly UnitTestResult[],
        readonly count: number,
        readonly pass: number,
        readonly fail: number,
        readonly error: number,
        readonly ignored: number,
    }
    
    function runTestPart(className: string, u: InstanceType<UnitTestClass>, methodName: string, failKind: 'error' | 'fail'): UnitTestResult | undefined {
        try {
            u[methodName]!.call(u);
        } catch(error: unknown) {
            console.error(`Exception thrown in ${className}.${methodName}:`, error);
            return {
                className,
                methodName,
                result: failKind,
                error,
                stackTrace: _cleanStackTrace(error),
            };
        }
    }
    
    function runTestMethod(cls: UnitTestClass, methodName: string): UnitTestResult {
        const className = cls.name;
        if(cls.prototype[methodName] === undefined) {
            return {
                className,
                methodName,
                result: 'error',
                error: undefined,
                stackTrace: `class ${className} has no test method named ${methodName}`,
            };
        } else if(cls.prototype[methodName][IGNORE_TEST_METHOD]) {
            return {className, methodName, result: 'ignored'};
        }
        
        let u: InstanceType<UnitTestClass>;
        try {
            u = new cls();
        } catch(error: unknown) {
            console.error(`Exception thrown in ${className}.constructor:`, error);
            return {
                className,
                methodName: 'constructor',
                result: 'error',
                error,
                stackTrace: _cleanStackTrace(error),
            };
        }
        
        return (u.before && runTestPart(className, u, 'before', 'error'))
            ?? runTestPart(className, u, methodName, 'fail')
            ?? (u.after && runTestPart(className, u, 'after', 'error'))
            ?? {className, methodName, result: 'pass'};
    }
    
    function runTestClass(cls: UnitTestClass): UnitTestClassResult {
        const rs = {
            className: cls.name,
            results: [] as UnitTestResult[],
            count: 0, pass: 0, fail: 0, error: 0, ignored: 0,
        };
        for(const k of Object.getOwnPropertyNames(cls.prototype).sort()) {
            if(k === 'constructor' || k === 'before' || k === 'after') { continue; }
            const r = runTestMethod(cls, k);
            rs.results.push(r);
            if(r.result !== 'ignored') { ++rs.count; }
            ++rs[r.result];
            if(r.result === 'error') { break; }
        }
        return rs;
    }
    
    function _cleanStackTrace(e: unknown): string {
        if(e instanceof Error && e.stack) {
            const str = e.stack;
            const i = str.lastIndexOf(`at ${runTestPart.name}`);
            return i >= 0 ? str.substring(0, i).trim() : str;
        } else {
            return `${e}`;
        }
    }
    
    const IGNORE_TEST_METHOD = Symbol();
    
    /**
     * Decorator for unit test class methods which should not be run.
     */
    export const ignore: MethodDecorator = function ignore(t, k, d) {
        (d.value as any)[IGNORE_TEST_METHOD] = true;
        return d;
    };
    
    const _TEST_CLASSES: UnitTestClass[] = [];
    
    export function test<K extends string>(cls: UnitTestClass<K>): void {
        _TEST_CLASSES.push(cls);
    }
    
    export function runAll(): UnitTestClassResult[] {
        return _TEST_CLASSES.map(runTestClass).sort((r1, r2) => r1.className.localeCompare(r2.className));
    }
    
    export function runOne(className: string, methodName: string): UnitTestResult {
        const cls = _TEST_CLASSES.find(cls => cls.name === className);
        return cls !== undefined
            ? runTestMethod(cls, methodName)
            : {
                className,
                methodName,
                result: 'error',
                error: undefined,
                stackTrace: `No such unit test class ${className}`,
            };
    }
    
    export function runAllInBrowser(): void {
        const COLOURS = {
            pass: 'green',
            fail: 'red',
            error: 'red',
            ignored: 'grey',
        };
        
        const results = Punyt.runAll();
        const totals = {count: 0, pass: 0, ignored: 0};
        for(const r of results) {
            totals.count += r.count;
            totals.pass += r.pass;
            totals.ignored += r.ignored;
        }
        
        function statsHtml(stats: Readonly<{count: number, pass: number, ignored: number}>): string {
            const colour = stats.count === 0 ? COLOURS.ignored
                : stats.pass === stats.count ? COLOURS.pass
                : COLOURS.fail;
            return `<span style="color:${colour}">${stats.pass}/${stats.count} passed</span>${
                stats.ignored > 0 ? `, <span style="color:${COLOURS.ignored}">${stats.ignored} ignored</span>` : ''}`;
        }
        
        const bodyElem = document.body;
        bodyElem.style.display = 'flex';
        bodyElem.style.flexDirection = 'column';
        bodyElem.style.alignItems = 'flex-start';
        
        const h2Elem = document.createElement('h2');
        h2Elem.innerHTML = `${results.length} test classes run (total ${statsHtml(totals)})`;
        bodyElem.appendChild(h2Elem);
        
        for(const classResult of results) {
            const h3Elem = document.createElement('h3');
            const codeElem = document.createElement('code');
            const plusMinusElem = document.createElement('span');
            const statsElem = document.createElement('span');
            const classDivElem = document.createElement('div');
            
            h3Elem.style.margin = '3px 0';
            plusMinusElem.innerText = '[\u2212]';
            statsElem.innerHTML = ` (${statsHtml(classResult)})`;
            codeElem.appendChild(plusMinusElem);
            codeElem.appendChild(document.createTextNode(` ${classResult.className}`));
            h3Elem.appendChild(codeElem);
            h3Elem.appendChild(statsElem);
            h3Elem.style.cursor = 'pointer';
            h3Elem.style.userSelect = 'none';
            classDivElem.style.margin = '1em 2.333em';
            
            bodyElem.appendChild(h3Elem);
            bodyElem.appendChild(classDivElem);
            
            h3Elem.onclick = () => {
                if(classDivElem.hidden) {
                    plusMinusElem.innerText = '[\u2212]';
                    classDivElem.hidden = false;
                } else {
                    plusMinusElem.innerText = '[+]';
                    classDivElem.hidden = true;
                }
            };
            
            if(classResult.pass + classResult.ignored === classResult.count) {
                h3Elem.click();
            }
            
            for(const r of classResult.results) {
                const divElem = document.createElement('div');
                function updateResult(r: Punyt.UnitTestResult): void {
                    divElem.innerHTML = `<code>${r.className}.${r.methodName}</code>: <b style="color:${COLOURS[r.result]}">${r.result}</b>`;
                    if(r.result === 'fail' || r.result === 'error') {
                        const preElem = document.createElement('pre');
                        preElem.innerText = r.stackTrace;
                        divElem.appendChild(preElem);
                        
                        const btnElem = document.createElement('button');
                        btnElem.innerText = 'Run again';
                        btnElem.onclick = () => updateResult(Punyt.runOne(r.className, r.methodName));
                        divElem.appendChild(btnElem);
                    }
                };
                updateResult(r);
                classDivElem.appendChild(divElem);
            }
        }
    }
}
