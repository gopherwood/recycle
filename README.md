# ♻️ Recycle #

This project enables simple object pooling to speed up object creation and reduce garbage collection. To use, simply include `recycle.js` in your project.

```js
include recycle from 'recycle.js';
```

The `recycle` object exposes an `add` method to add recycling to an object definition. For example:

```js
const Box = function (size) {
        this.size = size;
    },
    boxCache = recycle.add(Box, 'Box');
```

Now `Box` objects will be recyclable. For more control, you can specify additional parameters as follows:

1. **ClassObject** (Object, required) - Object definition to add recycling to. (`Box` above.)
2. **name** (String, required) - The name of the object type. This maintains a key reference in `recycle.cache` containing all unused, cached objects.
3. **setUp** (Function, optional) - An initialization method that should be called when a new instance is created if there is any object set-up involved. For factory functions, this could just be the constructor itself.
4. **tearDown** (Function, optional) - A tear-down method that should be called when an instance is recycled. This is a good place to `null` or `0` out properties before storing in cache for re-use later.
5. **mixinMethods** (Boolean, optional) - By default, this is `false`, but set to `true` to add static `setUp` and `recycle` methods to the recyclable object, and a `recycle` method to the recyclable object's prototype. This makes set-up and recycling more convenient, but be a good neighbor and do not set this to `true` for objects you don't control (for example, `Array`) as it *may* conflict with pre-existing methods.
6. **debug** (Boolean, optional) - Sets whether to log recycling issues to the console. For example, if an object is recycled twice, there may be issues. This is slower, but highly recommended to be used during development.

The `add` method returns a cache object that exposes a `setUp` method for getting a new object and a `recycle` method for returning an object to this cache. This same cache object is available at `recycle.cache[name]`.

For the above example, we might do:

```js
const Box = function (size) {
        this.size = size;
    },
    boxCache = recycle.add(Box, 'Box', Box, function () {
        this.size = '';
    }, true, true);
```

When `mixinMethods` is set to `true`, recyclable objects are given two methods to manage recycling: `setUp` and `recycle`. Additionally, a `recycle` method is added to the object's prototype for easy reference.

So, for example, instead of using:

```js
const box = new Box('big');
```

To use a recycled `Box` or create a new instance if none are available, use any of the following:

```js
// Get a new Box from `recycle`
const box = recycle.cache['Box'].setUp('small');

// Get a new Box from local cache reference
const box = boxCache.setUp('small');

// If `mixinMethods` is `true`, use the class object itself
const box = Box.setUp('small');
```

And then once it's no longer needed, it can be returned to the cache using any of the following:

```js
// Recycle from the `recycle` object
recycle.cache['Box'].recycle(box);

// Recycle from local cache reference
boxCache.recycle(box);

// If `mixinMethods` is `true`, use either of the following
box.recycle();
// or
Box.recycle(box);
```

Finally, if you are storing a reference to a recycled object, as a property for example, be sure to set the property to `null` to prevent accidentally using it later. For example:

```js
// Getting a box to use
this.box = Box.setUp('big');

// No longer need the box
this.box.recycle();
this.box = null;
```

If Array is added to the recycling system (without a custom tear-down function), it accepts a parameter to recycle multiple dimensions. So, for example, a two-dimensional array set up like:

```js
const arrayCache = recycle.add(Array, 'Array'),
    arr = arrayCache.setUp(arrayCache.setUp(), arrayCache.setUp());
```

Can be fully recycled by passing its dimensions into the `recycle` method:

```js
arr.recycle(2);
```

Objects currently in use are not referenceable from the recycling system, but all unused cached objects are accessible from `recycle.cache`.
