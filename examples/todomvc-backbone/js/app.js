/** @jsx React.DOM */

function cx(obj) {
  var s = '';
  for (var key in obj) {
    if (!obj.hasOwnProperty(key)) {
      continue;
    }
    if (obj[key]) {
      s += key + ' ';
    }
  }
  return s;
}

var Todo = Backbone.Model.extend({

  // Default attributes for the todo
  // and ensure that each todo created has `title` and `completed` keys.
  defaults: {
    title: '',
    completed: false
  },

  // Toggle the `completed` state of this todo item.
  toggle: function() {
    this.save({
      completed: !this.get('completed')
    });
  }

});

var TodoList = Backbone.Collection.extend({

  // Reference to this collection's model.
  model: Todo,

  // Save all of the todo items under the `"todos"` namespace.
  localStorage: new Store('todos-backbone'),

  // Filter down the list of all todo items that are finished.
  completed: function() {
    return this.filter(function( todo ) {
      return todo.get('completed');
    });
  },

  // Filter down the list to only todo items that are still not finished.
  remaining: function() {
    return this.without.apply( this, this.completed() );
  },

  // We keep the Todos in sequential order, despite being saved by unordered
  // GUID in the database. This generates the next order number for new items.
  nextOrder: function() {
    if ( !this.length ) {
      return 1;
    }
    return this.last().get('order') + 1;
  },

  // Todos are sorted by their original insertion order.
  comparator: function( todo ) {
    return todo.get('order');
  }
});

// Create our global collection of **Todos**.
var Todos = new TodoList();

var TodoFilter;

var Workspace = Backbone.Router.extend({
  routes:{
    '*filter': 'setFilter'
  },

  setFilter: function( param ) {
    // Set the current filter to be used
    TodoFilter = param.trim() || '';

    // Trigger a collection filter event, causing hiding/unhiding
    // of Todo view items
    Todos.trigger('filter');
  }
});

var TodoRouter = new Workspace();
Backbone.history.start();

var Utils = {
  // https://gist.github.com/1308368
  uuid: function(a,b){for(b=a='';a++<36;b+=a*51&52?(a^15?8^Math.random()*(a^20?16:4):4).toString(16):'-');return b},
  pluralize: function( count, word ) {
    return count === 1 ? word : word + 's';
  },
  store: function( namespace, data ) {
    if ( arguments.length > 1 ) {
      return localStorage.setItem( namespace, JSON.stringify( data ) );
    } else {
      var store = localStorage.getItem( namespace );
      return ( store && JSON.parse( store ) ) || [];
    }
  }
};

// Begin React stuff

var ENTER_KEY = 13;

var TodoItem = React.createClass({
  getInitialState: function() {
    return {editValue: this.props.todo.title};
  },
  onKeyUp: React.autoBind(function(event) {
    this.setState({editValue: event.target.value});
    var val = event.target.value.trim();
    if (event.nativeEvent.keyCode !== ENTER_KEY || !val) {
      return;
    }
    this.props.onSave(val);
  }),
  onEdit: React.autoBind(function() {
    this.props.onEdit();
    this.refs.editField.getDOMNode().focus();
  }),
  render: function() {
    return (
      <li class={cx({completed: this.props.todo.completed, editing: this.props.editing})}>
        <div class="view">
          <input
            class="toggle"
            type="checkbox"
            checked={this.props.todo.completed ? 'checked' : null}
            onChange={this.props.onToggle}
          />
        <label onDoubleClick={this.onEdit}>{this.props.todo.title}</label>
           <button class="destroy" onClick={this.props.onDestroy} />
        </div>
        <input ref="editField" class="edit" value={this.state.editValue} onKeyUp={this.onKeyUp} />
      </li>
    );
  }
});

var TodoFooter = React.createClass({
  render: function() {
    var activeTodoWord = Utils.pluralize(this.props.count, 'todo');
    var clearButton = null;

    if (this.props.completedCount > 0) {
      clearButton = (
        <button class="clear-completed" onClick={this.props.onClearCompleted}>Clear completed ({this.props.completedCount})</button>
      );
    }

    return (
      <footer class="footer">
        <span class="todo-count"><strong>{this.props.count}</strong>{' '}{activeTodoWord}{' '}left</span>
        {clearButton}
      </footer>
    );
  }
});

var TodoApp = React.createClass({
  getInitialState: function() {
    return {todos: Utils.store('todos-react'), newTodoValue: '', editing: {}};
  },
  handleKeyUp: React.autoBind(function(event) {
    this.setState({newTodoValue: event.target.value});
    var val = event.target.value.trim();
    if (event.nativeEvent.keyCode !== ENTER_KEY || !val) {
      return;
    }
    var todos = this.state.todos;
    todos.push({id: Utils.uuid(), title: val, completed: false});
    this.setState({todos: todos, newTodoValue: ''});
  }),
  toggleAll: function(event) {
    var checked = event.nativeEvent.target.checked;
    this.state.todos.map(function(todo) {
      todo.completed = checked;
    });
    this.setState({todos: this.state.todos});
  },
  toggle: function(todo) {
    todo.completed = !todo.completed;
    this.setState({todos: this.state.todos});
  },
  destroy: function(todo) {
    this.setState({todos: this.state.todos.filter(function(candidate) { return candidate.id !== todo.id; })});
  },
  edit: function(todo) {
    this.state.todos.map(function(todo) { this.state.editing[todo.id] = false; }.bind(this));
    this.state.editing[todo.id] = true;
    this.setState({editing: this.state.editing});
  },
  save: function(todo, text) {
    todo.title = text;
    this.state.editing[todo.id] = false;
    this.setState({todos: this.state.todos, editing: this.state.editing});
  },
  clearCompleted: function() {
    this.setState({todos: this.state.todos.filter(function(todo) { return !todo.completed })});
  },
  render: function() {
    Utils.store(this.props.localStorageKey || 'todos-react', this.state.todos);
    var footer = null;
    var main = null;
    var todoItems = this.state.todos.map(function(todo) {
      return <TodoItem todo={todo} onToggle={this.toggle.bind(this, todo)} onDestroy={this.destroy.bind(this, todo)} onEdit={this.edit.bind(this, todo)} editing={this.state.editing[todo.id]} onSave={this.save.bind(this, todo)} />;
    }.bind(this));

    var activeTodoCount = this.state.todos.filter(function(todo) { return !todo.completed }).length;
    var completedCount = todoItems.length - activeTodoCount;
	if (activeTodoCount || completedCount) {
      footer = <TodoFooter count={activeTodoCount} completedCount={completedCount} onClearCompleted={this.clearCompleted.bind(this)} />;
    }

    if (todoItems.length) {
      main = (
        <section class="main">
          <input class="toggle-all" type="checkbox" onChange={this.toggleAll.bind(this)} />
          <label class="toggle-all-label">Mark all as complete</label>
          <ul class="todo-list">
            {todoItems}
          </ul>
        </section>
      );
    }

    return (
      <div>
        <section class="todoapp">
          <header class="header">
            <h1>todos</h1>
            <input class="new-todo" placeholder="What needs to be done?" autofocus="autofocus" onKeyUp={this.handleKeyUp} value={this.state.newTodoValue} />
          </header>
          {main}
          {footer}
        </section>
        <footer class="info">
          <p>Double-click to edit a todo</p>
          <p>Created by{' '}<a href="http://github.com/petehunt/">petehunt</a></p>
          <p>Part of{' '}<a href="http://todomvc.com">TodoMVC</a></p>
        </footer>
      </div>
    );
  }
});

React.renderComponent(<TodoApp />, document.getElementById('todoapp'));
