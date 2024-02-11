"use strict";
var Assert;
(function (Assert) {
    function _str(x) {
        return typeof x === 'string' ? JSON.stringify(x)
            : typeof x === 'symbol' ? `Symbol(${x.description !== undefined ? "'" + x.description + "'" : ''})`
                : `${x}`;
    }
    class AssertionError extends Error {
    }
    Assert.AssertionError = AssertionError;
    let _failLoggingEnabled = true;
    function fail(message, ...args) {
        if (_failLoggingEnabled && args.length > 0) {
            console.error(message, ...args);
        }
        throw new AssertionError(message);
    }
    Assert.fail = fail;
    function isTrue(b, message) {
        if (!b) {
            fail(message);
        }
    }
    Assert.isTrue = isTrue;
    function isFalse(b, message) {
        if (b) {
            fail(message);
        }
    }
    Assert.isFalse = isFalse;
    function isNaN(x, message) {
        if (x === x) {
            fail(`Expected NaN, was ${x}\n${message}`, x);
        }
    }
    Assert.isNaN = isNaN;
    function equal(x, y, message) {
        if (x !== y) {
            fail(`${_str(x)} !== ${_str(y)}\n${message}`, x, y);
        }
    }
    Assert.equal = equal;
    function notEqual(x, y, message) {
        if (x === y) {
            fail(`${_str(x)} === ${_str(y)}\n${message}`, x, y);
        }
    }
    Assert.notEqual = notEqual;
    function approx(x, y, epsilon, message) {
        if (Math.abs(x - y) >= epsilon) {
            fail(`${x} !== ${y}\n${message}`, x, y);
        }
    }
    Assert.approx = approx;
    const equalMembers = function (x, y, eqTest) {
        if (x === y) {
            return true;
        }
        else if (Array.isArray(x)) {
            return Array.isArray(y) && x.length === y.length && x.every((x_i, i) => eqTest(x_i, y[i]));
        }
        else if (typeof x === 'object' && typeof y === 'object') {
            if (x === null || y === null) {
                return false;
            }
            const xKeys = Object.keys(x).sort();
            const yKeys = Object.keys(y).sort();
            return isShallowEqual(xKeys, yKeys) && xKeys.every(k => eqTest(x[k], y[k]));
        }
        return false;
    };
    const isDirectEqual = (x, y) => x === y;
    const isShallowEqual = (x, y) => equalMembers(x, y, isDirectEqual);
    const isDeepEqual = (x, y) => equalMembers(x, y, isDeepEqual);
    function shallowEqual(x, y, message) {
        if (!isShallowEqual(x, y)) {
            fail(`${_str(x)}\n  !== ${_str(y)}\n${message}`, x, y);
        }
    }
    Assert.shallowEqual = shallowEqual;
    function deepEqual(x, y, message) {
        if (!isDeepEqual(x, y)) {
            fail(`${_str(x)}\n  !== ${_str(y)}\n${message}`, x, y);
        }
    }
    Assert.deepEqual = deepEqual;
    function distinct(arr, message) {
        const set = new Set();
        for (const x of arr) {
            if (set.has(x)) {
                fail(`${_str(x)} in [${arr.map(_str).join(', ')}]\n${message}`, x, arr);
            }
            set.add(x);
        }
    }
    Assert.distinct = distinct;
    function distinctByKey(arr, keyFunc, message) {
        const map = new Map();
        for (const x of arr) {
            const key = keyFunc(x);
            if (map.has(key)) {
                const y = map.get(key);
                fail(`${_str(y)} and ${_str(x)} share key ${key} in [${arr.map(_str).join(', ')}]\n${message}`, y, x, key, arr);
            }
            map.set(key, x);
        }
    }
    Assert.distinctByKey = distinctByKey;
    function throws(f, message) {
        throwsLike(f, () => true, message);
    }
    Assert.throws = throws;
    function throwsLike(f, errorPredicate, message) {
        const oldLoggingEnabled = _failLoggingEnabled;
        _failLoggingEnabled = false;
        try {
            f();
        }
        catch (e) {
            if (errorPredicate(e)) {
                return;
            }
            else {
                fail(`Exception thrown does not satisfy predicate: ${_str(e)}\n${message}`, e);
            }
        }
        finally {
            _failLoggingEnabled = oldLoggingEnabled;
        }
        fail(`Expected exception, but none was thrown\n${message}`);
    }
    Assert.throwsLike = throwsLike;
})(Assert || (Assert = {}));
var Punyt;
(function (Punyt) {
    function runTestPart(className, u, methodName, failKind) {
        try {
            u[methodName].call(u);
        }
        catch (error) {
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
    function runTestMethod(cls, methodName) {
        const className = cls.name;
        if (cls.prototype[methodName] === undefined) {
            return {
                className,
                methodName,
                result: 'error',
                error: undefined,
                stackTrace: `class ${className} has no test method named ${methodName}`,
            };
        }
        else if (cls.prototype[methodName][IGNORE_TEST_METHOD]) {
            return { className, methodName, result: 'ignored' };
        }
        let u;
        try {
            u = new cls();
        }
        catch (error) {
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
            ?? { className, methodName, result: 'pass' };
    }
    function runTestClass(cls) {
        const rs = {
            className: cls.name,
            results: [],
            count: 0, pass: 0, fail: 0, error: 0, ignored: 0,
        };
        for (const k of Object.getOwnPropertyNames(cls.prototype).sort()) {
            if (k === 'constructor' || k === 'before' || k === 'after') {
                continue;
            }
            const r = runTestMethod(cls, k);
            rs.results.push(r);
            if (r.result !== 'ignored') {
                ++rs.count;
            }
            ++rs[r.result];
            if (r.result === 'error') {
                break;
            }
        }
        return rs;
    }
    function _cleanStackTrace(e) {
        if (e instanceof Error && e.stack) {
            const str = e.stack;
            const i = str.lastIndexOf(`at ${runTestPart.name}`);
            return i >= 0 ? str.substring(0, i).trim() : str;
        }
        else {
            return `${e}`;
        }
    }
    const IGNORE_TEST_METHOD = Symbol();
    /**
     * Decorator for unit test class methods which should not be run.
     */
    Punyt.ignore = function ignore(t, k, d) {
        d.value[IGNORE_TEST_METHOD] = true;
        return d;
    };
    const _TEST_CLASSES = [];
    function test(cls) {
        _TEST_CLASSES.push(cls);
    }
    Punyt.test = test;
    function runAll() {
        return _TEST_CLASSES.map(runTestClass).sort((r1, r2) => r1.className.localeCompare(r2.className));
    }
    Punyt.runAll = runAll;
    function runOne(className, methodName) {
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
    Punyt.runOne = runOne;
    function runAllInBrowser() {
        const COLOURS = {
            pass: 'green',
            fail: 'red',
            error: 'red',
            ignored: 'grey',
        };
        const results = Punyt.runAll();
        const totals = { count: 0, pass: 0, ignored: 0 };
        for (const r of results) {
            totals.count += r.count;
            totals.pass += r.pass;
            totals.ignored += r.ignored;
        }
        function statsHtml(stats) {
            const colour = stats.count === 0 ? COLOURS.ignored
                : stats.pass === stats.count ? COLOURS.pass
                    : COLOURS.fail;
            return `<span style="color:${colour}">${stats.pass}/${stats.count} passed</span>${stats.ignored > 0 ? `, <span style="color:${COLOURS.ignored}">${stats.ignored} ignored</span>` : ''}`;
        }
        const bodyElem = document.body;
        bodyElem.style.display = 'flex';
        bodyElem.style.flexDirection = 'column';
        bodyElem.style.alignItems = 'flex-start';
        const h2Elem = document.createElement('h2');
        h2Elem.innerHTML = `${results.length} test classes run (total ${statsHtml(totals)})`;
        bodyElem.appendChild(h2Elem);
        for (const classResult of results) {
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
                if (classDivElem.hidden) {
                    plusMinusElem.innerText = '[\u2212]';
                    classDivElem.hidden = false;
                }
                else {
                    plusMinusElem.innerText = '[+]';
                    classDivElem.hidden = true;
                }
            };
            if (classResult.pass + classResult.ignored === classResult.count) {
                h3Elem.click();
            }
            for (const r of classResult.results) {
                const divElem = document.createElement('div');
                function updateResult(r) {
                    divElem.innerHTML = `<code>${r.className}.${r.methodName}</code>: <b style="color:${COLOURS[r.result]}">${r.result}</b>`;
                    if (r.result === 'fail' || r.result === 'error') {
                        const preElem = document.createElement('pre');
                        preElem.innerText = r.stackTrace;
                        divElem.appendChild(preElem);
                        const btnElem = document.createElement('button');
                        btnElem.innerText = 'Run again';
                        btnElem.onclick = () => updateResult(Punyt.runOne(r.className, r.methodName));
                        divElem.appendChild(btnElem);
                    }
                }
                ;
                updateResult(r);
                classDivElem.appendChild(divElem);
            }
        }
    }
    Punyt.runAllInBrowser = runAllInBrowser;
})(Punyt || (Punyt = {}));
