# punyt.js

Punyt is a tiny JavaScript unit testing framework that shows test results in the browser.

Write unit tests as methods in classes, JUnit style:

```javascript
Punyt.test(class SimpleTests {
    onePlusOne() {
        Assert.equal(2, 1 + 1,
            'One plus one should equal two');
    }
    
    twoPlusTwo() {
        const numbers = [2];
        numbers.push(2);
        
        Assert.shallowEqual([2, 2], numbers,
            'Two plus two should equal [2, 2]');
    }
    
    threePlusThree() {
        Assert.notEqual('Six', 'Three' + 'Three',
            'String concatenation should not perform arithmetic!');
    }
});
```

More advanced usage (see more methods in the TypeScript type declarations):

```javascript
function lineDistance(line) {
    return Math.hypot(line.q.x - line.p.x, line.q.y - line.p.y);
}

Punyt.test(class VectorTests {
    // Each test is run independently with a fresh instance of `VectorTests`.
    line = {};
    
    before() {
        // Setup method, run before each test.
        this.line.p = {x: 0, y: 0};
        this.line.q = {x: 3, y: 4};
    }
    
    after() {
        // Teardown method, run after each test.
    }
    
    fourPlusFour() {
        this.line.q.y += 4;
        
        const expected = {p: {x: 0, y: 0}, q: {x: 3, y: 8}};
        Assert.deepEqual(expected, this.line,
            'Four plus four should equal eight');
    }
    
    pythagoras() {
        const actualDistance = lineDistance(this.line);
        Assert.approx(5, actualDistance,
            1e-8,
            'Hypotenuse of a (3, 4) right triangle should be 5');
    }
    
    // If method decorators are supported, you can mark a test to be skipped.
    @Punyt.ignore
    defunctTest() {
        // This test will not run, but it will be reported as 'ignored'.
    }
});
```

Run the tests in a browser:

```html
<!DOCTYPE html>
<html>
<body>
    <script src="https://kaya3.github.io/punyt/punyt.min.js"></script>
    <script src="my-unit-tests.js"></script>
    <script type="text/javascript">
        Punyt.runAllInBrowser();
    </script>
</body>
</html>
```