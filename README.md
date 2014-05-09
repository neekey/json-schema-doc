## json-schema-doc

用于生成json-schema文档的生成器。输出纯HTML。
Documentation generator for json-schema.

效果见[Demo](http://groups.demo.taobao.net/jsonnanny/json-schema-doc/test/index.html)

## 安装

NPM:

```
npm install json-schema-doc --save
```

[TBower](http://bower.fed.taobao.net/#/home)

```
tbower install json-schema-doc --save
```

## 使用

```
// 若在浏览器中使用，不借助包管理，默认是window.JsonSchemaDocGenerator
var JsonSchemaDocGenerator = require( 'json-schema-doc' );

JsonSchemaDocGenerator( {
    type: 'object',
    description: '这是数据结构',
    properties: {
        name: {
            type: 'string',
            description: '用户名称'
        }
    }
});

```

## 如果想要获得包含交互功能的文档

这个功能依赖jQuery

```
JsonSchemaDocGenerator.buildWithJQ( {
    type: 'object',
    description: '这是数据结构',
    properties: {
        name: {
            type: 'string',
            description: '用户名称'
        }
    }
}, {}, targetDOM );
```
该方法将会渲染节点，添加事件，并放入targetDOM中。

### $ref

如果schema包含了 `$ref` 关键词，回先从 schema 的本地的 `definitions` 中去查找，否则用户可以通过options来给定外部ref.

#### 查找本地例子

```
JsonSchemaDocGenerator( {
    type: 'object',
    description: '这是数据结构',
    properties: {
        name: {
            type: 'string',
            description: '用户名称'
        },
        sex {
            $ref: '#/definitions/sex'
        }
    },
    definitions: {
        sex: {
            type: 'string',
            description: '性别'
        }
    }
});

```

这样子是可以对应到位置的。

#### 非本地ref

```
JsonSchemaDocGenerator( {
    type: 'object',
    description: '这是数据结构',
    properties: {
        name: {
            type: 'string',
            description: '用户名称'
        },
        sex {
            $ref: 'http://remote/sex.schema'
        }
    }
}, {
    refs: {
        'http://remote/sex.schema': {
            type: 'string',
            description: '性别'
        }
    }
});

```