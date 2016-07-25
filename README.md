** Recycle **

This project enables simple object pooling to speed up object creation and avoid garbage collection. To use, simply include `recycle.js` in your project. Once included, it adds a `recycle` object to `window`. This object exposes a single method `add` to add recycling to an object definition. For example:

    var Box = function (size) {
        this.size = size;
    };

    window.recycle.add(Box);

Now `Box` objects will be recyclable. For more control, you can specify additional parameters as follows:

1. class - Object definition to add recycling to.
2. debug - Whether to log recycling issues to the console. For example, if an object is recycled twice, there may be issues. This is slower, but better to use during development.
3. name - The name of the object type. This is useful when referencing the list of key/value pairs at `window.recycle.cache` that lists all unused cached objects.
4. recycle - An alternative recycling function to use. This is useful if any tear-down is needed, but should always include `[ObjectName].recycle(this)` to add the object to the cache for reuse.

For the above example, we might use 

    var Box = function (size) {
        this.size = size;
    };

    window.recycle.add(Box, true, 'Box', function () {
        this.size = '';
        Box.recycle(this);
    });

Recyclable constructors are given two methods to manage recycling: `setUp` and `recycle`. Additionally, a `recycle` method is added to the object's prototype for easy reference and can be overridden as shown above. So, for example, instead of using:

    var box = new Box('big');

To use a recycled `Box` or create a new instance if not are available, use the following:

    var box = Box.setUp('big');

And then once it's no longer needed, it can be returned to the cache by:

    box.recycle();

Or:

    Box.recycle(box);

If Array is added to the recycling system, it provides an additional feature. They can recycle multiple dimensions using a single call for convenience. So, for example, a two-dimensional array set up like:

    window.recycle.add(Array);

    var arr = Array.setUp(Array.setUp(), Array.setUp(), Array.setUp());

Can be recycled by passing its dimensions into the `recycle` method:

    arr.recycle(2)

Objects currently in use are not referenceable from the recycling system, but all unused cached objects are accessible from `window.recycle.cache`.
