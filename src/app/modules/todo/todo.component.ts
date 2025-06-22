import { Todo, TodosService, Column, TableConfig } from './../../shared/todos.service';
import {
  ChangeDetectorRef,
  Component,
  OnInit,
  AfterViewInit,
  HostListener
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-todo',
  imports: [CommonModule, FormsModule],
  templateUrl: './todo.component.html',
  styleUrl: './todo.component.scss',
})
export class TodoComponent implements OnInit, AfterViewInit {
  todos: Todo[] = [];
  tableConfig: TableConfig | null = null;
  columns: Column[] = [];

  selectedCell: { row: number; col: number } | null = null;
  editingCell: { row: number; col: number } | null = null;
  editValue: string = '';
  cellEditValues: Map<string, string> = new Map();

  selectedRowIndex: number | null = null;
  selectedColumnIndex: number | null = null;
  
  headerEditingIndex: number | null = null;
  editHeaderValue: string = '';
  
  newColumnHeader: string = '';
  isAddingColumn: boolean = false;
  isDeletingRow: boolean = false;

  constructor(
    private todosService: TodosService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadTableConfig();
  }

  ngAfterViewInit(): void {
    this.setupResizableColumns();
  }

  private loadTableConfig(): void {
    this.todosService.getTableConfig().subscribe({
      next: (config) => {
        if (config && config.columns && config.columns.length > 0) {
          this.columns = config.columns.sort((a, b) => (a.order || 0) - (b.order || 0));
          this.tableConfig = config;
          this.loadTodos();
        } else {
          this.saveDefaultTableConfig();
        }
      },
      error: (err) => {
        console.error('Failed to fetch table config:', err);
        if (err.status === 404) {
          this.saveDefaultTableConfig();
        } else {
          alert('Failed to load table configuration. Please check the backend connection.');
        }
      },
    });
  }

  private saveDefaultTableConfig(): void {
    const defaultConfig: TableConfig = {
      name: 'Default Table',
      columns: [
        { title: 'S.No', field: 'serialNo', editable: false, order: 0 },
        { title: 'Name', field: 'name', editable: true, order: 1 },
        { title: 'Email', field: 'email', editable: true, order: 2 },
      ],
    };

    this.todosService.saveTableConfig(defaultConfig).subscribe({
      next: (savedConfig) => {
        console.log('Default table config saved:', savedConfig);
        this.loadTableConfig();
      },
      error: (err) => {
        console.error('Failed to save default table config:', err);
        alert('Could not initialize table configuration. Please try again.');
      },
    });
  }

  private loadTodos(): void {
    this.todosService.getTodos().subscribe({
      next: (data) => {
        this.todos = data.map((todo: any) => ({
          ...todo,
          id: todo._id,
        }));
        setTimeout(() => this.setupResizableColumns(), 0);
      },
      error: (err) => console.error('Failed to fetch todos:', err),
    });
  }

  @HostListener('document:keydown', ['$event'])
  handleKeydown(event: KeyboardEvent): void {
    if (event.ctrlKey && event.key === 'n') {
      event.preventDefault();
      this.addNewRow();
    }
    if (event.ctrlKey && event.shiftKey && event.key === 'N') {
      event.preventDefault();
      const input = document.querySelector('input[placeholder="New column name"]') as HTMLInputElement;
      if (input) {
        input.focus();
      }
    }
    if (event.key === 'Delete') {
      this.handleDeleteKey();
    }
  }

  setupResizableColumns(): void {
    const headers = document.querySelectorAll(
      '.excel-table thead th.resizable-header'
    );

    headers.forEach((headerEl, colIndex) => {
      const header = headerEl as HTMLElement;
      const resizer = header.querySelector('.resizer') as HTMLElement;

      if (!resizer) return;

      let startX = 0;
      let startWidth = 0;

      const onMouseMove = (e: MouseEvent) => {
        const newWidth = Math.max(50, startWidth + (e.clientX - startX));
        header.style.width = `${newWidth}px`;

        const rows = document.querySelectorAll('.excel-table tbody tr');
        rows.forEach((row) => {
          const cell = row.children[colIndex] as HTMLElement;
          if (cell) cell.style.width = `${newWidth}px`;
        });

        if (this.columns[colIndex]) {
          this.columns[colIndex].width = newWidth;
          this.updateColumnInDatabase(colIndex);
        }
      };

      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      };

      resizer.addEventListener('mousedown', (e: MouseEvent) => {
        e.preventDefault();
        startX = e.clientX;
        startWidth = header.offsetWidth;

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
      });
    });
  }

  private updateColumnInDatabase(colIndex: number): void {
    if (!this.tableConfig?.columns) return;

    const column = this.columns[colIndex];
    const columnInConfig = this.tableConfig.columns.find(col => col.field === column.field);
    if (columnInConfig && (columnInConfig as any)._id) {
      this.todosService.updateColumn((columnInConfig as any)._id, { width: column.width }).subscribe({
        next: () => console.log(`Column width updated for ${column.title}`),
        error: (err) => console.error('Failed to update column width:', err)
      });
    }
  }

  addNewRow(): void {
    const newTodo: Todo = {
      title: '',
      name: '',
      email: '',
      age: null,
      address: '',
      password: '',
      completed: false,
    };

    this.columns.forEach(col => {
      if (col.field !== 'serialNo' && col.field !== 'index') {
        if (col.field === 'age') {
          (newTodo as any)[col.field] = null;
        } else {
          (newTodo as any)[col.field] = '';
        }
      }
    });

    console.log('Adding new row with todo:', newTodo);

    this.todosService.addTodo(newTodo).subscribe({
      next: (createdTodo) => {
        console.log('Successfully created todo:', createdTodo);
        
        this.loadTodos();
        
        setTimeout(() => {
          const newRowIndex = this.todos.length - 1;
          if (newRowIndex >= 0) {
            this.selectedRowIndex = newRowIndex;
            this.selectedCell = null;
            this.selectedColumnIndex = null;
            
            const firstEditableCol = this.columns.findIndex(col => col.field !== 'serialNo' && col.editable !== false);
            if (firstEditableCol !== -1) {
              this.startEditing(newRowIndex, firstEditableCol);
            }
            
            console.log('New row added and selected at index:', newRowIndex);
            this.cdr.detectChanges();
          }
        }, 100);
      },
      error: (err) => {
        console.error('Failed to add todo:', err);
        alert('Failed to add new row. Please try again.');
      },
    });
  }

  deleteRow(): void {
    if (this.selectedRowIndex === null) {
      console.log('No row selected for deletion');
      return;
    }

    if (this.isDeletingRow) {
      console.log('Already deleting a row, ignoring request');
      return;
    }

    const todo = this.todos[this.selectedRowIndex];
    if (!todo?.id) {
      console.log('Selected todo has no ID, cannot delete');
      return;
    }

    console.log('Deleting row at index:', this.selectedRowIndex, 'with todo:', todo);
    this.isDeletingRow = true;

    this.todosService.deleteTodo(todo.id).subscribe({
      next: (response) => {
        console.log('Successfully deleted todo, response:', response);
        
        // Remove the todo from the local array immediately
        if (this.selectedRowIndex !== null) {
          this.todos.splice(this.selectedRowIndex, 1);
        }
        
        // Reset selection
        this.selectedRowIndex = null;
        this.selectedCell = null;
        this.isDeletingRow = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Failed to delete row, error details:', err);
        this.isDeletingRow = false;
        // Only show error if it's not a successful deletion
        if (err.status !== 200 && err.status !== 204) {
          alert('Failed to delete row. Please try again.');
        }
      },
    });
  }

  handleDeleteKey(): void {
    if (this.selectedRowIndex !== null) {
      this.deleteRow();
    } else if (this.selectedColumnIndex !== null) {
      this.deleteSelectedColumn();
    }
  }

  handleCellClick(rowIndex: number, colIndex: number): void {
    const field = this.columns[colIndex].field;
    
    if (field === 'serialNo') {
      this.selectedRowIndex = rowIndex;
      this.selectedColumnIndex = null;
      this.selectedCell = null;
      this.editingCell = null;
      return;
    }
    
    this.selectedRowIndex = null;
    this.selectedColumnIndex = null;
    this.selectedCell = { row: rowIndex, col: colIndex };
    this.startEditing(rowIndex, colIndex);
  }

  startEditing(row: number, col: number): void {
    const field = this.columns[col].field;
    if (field === 'serialNo') {
      this.editingCell = null;
      return;
    }
    
    if (this.columns[col].editable !== false) {
      this.editingCell = { row, col };
      const value = this.todos[row][field as keyof Todo];
      this.cellEditValues.set(`${row}-${col}`, value != null ? value.toString() : '');
    } else {
      this.editingCell = null;
    }
  }

  saveEdit(): void {
    if (!this.editingCell) return;

    const { row, col } = this.editingCell;
    const field = this.columns[col].field;
    const todo = this.todos[row];
    const todoId = todo._id || todo.id;

    if (field !== 'serialNo' && todoId) {
      const parsedValue = this.parseFieldValue(field, this.cellEditValues.get(`${row}-${col}`) || '');
      (todo as any)[field] = parsedValue;

      this.todosService.updateTodo(todoId, todo).subscribe({
        next: () => {
          console.log('Cell updated successfully');
          this.loadTodos();
        },
        error: (err) => {
          console.error('Failed to update cell:', err);
          alert('Failed to save cell: ' + (err?.error?.error || err.message || 'Unknown error'));
        },
      });
    }

    this.editingCell = null;
    this.cellEditValues.delete(`${row}-${col}`);
  }

  cancelEdit(): void {
    if (this.editingCell) {
      this.cellEditValues.delete(`${this.editingCell.row}-${this.editingCell.col}`);
    }
    this.editingCell = null;
  }

  updateCellEditValue(rowIndex: number, colIndex: number, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.cellEditValues.set(`${rowIndex}-${colIndex}`, value);
  }

  onCellKeydown(event: KeyboardEvent, rowIndex: number, colIndex: number): void {
    if (event.key === 'Delete') {
      event.preventDefault();
      this.clearCell(rowIndex, colIndex);
    }
  }

  clearCell(rowIndex: number, colIndex: number): void {
    const field = this.columns[colIndex].field;
    const todo = this.todos[rowIndex];
    const todoId = todo._id || todo.id;

    if (field !== 'serialNo' && todoId) {
      (todo as any)[field] = field === 'age' ? null : '';
      this.todos = [...this.todos];

      if (this.editingCell && this.editingCell.row === rowIndex && this.editingCell.col === colIndex) {
        this.cellEditValues.set(`${rowIndex}-${colIndex}`, '');
      }

      this.todosService.updateTodo(todoId, todo).subscribe({
        next: () => {
          console.log(`Cleared cell at row ${rowIndex}, column ${colIndex}`);
          this.loadTodos();
        },
        error: (err) => {
          console.error('Clear cell failed:', err);
          alert('Failed to clear cell: ' + (err?.error?.error || err.message || 'Unknown error'));
        },
      });
    }
  }

  parseFieldValue(field: string, value: string): any {
    if (field === 'age') {
      const parsed = parseInt(value, 10);
      return isNaN(parsed) ? null : parsed;
    }
    return value;
  }

  getCellValue(todo: Todo, field: string): string | number | null {
    if (field === 'serialNo') {
      const value = (todo as any)['serialNo'] || this.todos.indexOf(todo) + 1;
      return value;
    }
    const value = (todo as any)[field] ?? '';
    return value;
  }

  isCellSelected(rowIndex: number, colIndex: number): boolean {
    return (
      this.selectedCell?.row === rowIndex && this.selectedCell?.col === colIndex
    );
  }

  isCellEditing(rowIndex: number, colIndex: number): boolean {
    return (
      this.editingCell?.row === rowIndex && this.editingCell?.col === colIndex
    );
  }

  handleRowClick(rowIndex: number): void {
    this.selectedRowIndex = rowIndex;
    this.selectedColumnIndex = null;
    this.selectedCell = null;
  }

  selectRow(rowIndex: number): void {
    this.selectedRowIndex = rowIndex;
  }

  isRowSelected(rowIndex: number): boolean {
    return this.selectedRowIndex === rowIndex;
  }

  isRowFullySelected(row: number): boolean {
    return this.selectedRowIndex === row;
  }

  handleHeaderClick(colIndex: number): void {
    this.selectedColumnIndex = colIndex;
    this.selectedRowIndex = null;
    this.selectedCell = null;
    this.editingCell = null;
  }

  selectColumn(colIndex: number): void {
    this.selectedRowIndex = null;
    this.selectedColumnIndex = colIndex;
  }

  isColumnSelected(colIndex: number): boolean {
    return this.selectedColumnIndex === colIndex;
  }

  startHeaderEditing(index: number): void {
    console.log('Starting header editing for index:', index, 'column:', this.columns[index]);
    if (this.columns[index].editable === false) {
      console.log('Column is not editable, returning');
      return;
    }
    
    this.headerEditingIndex = index;
    this.editHeaderValue = this.columns[index].title;
    console.log('Header editing started with value:', this.editHeaderValue);
  }

  stopHeaderEditing(): void {
    console.log('Stopping header editing, current index:', this.headerEditingIndex);
    this.saveHeaderEdit();
  }

  updateHeaderTitle(colIndex: number, newValue: string): void {
    console.log('Updating header title for column:', colIndex, 'new value:', newValue);
    this.headerEditingIndex = colIndex;
    this.editHeaderValue = newValue;
  }

  saveHeaderEdit(): void {
    console.log('Saving header edit, index:', this.headerEditingIndex, 'value:', this.editHeaderValue);
    if (this.headerEditingIndex === null) {
      console.log('No header editing index, returning');
      return;
    }
    
    const index = this.headerEditingIndex;
    const newTitle = this.editHeaderValue.trim();
    
    if (newTitle) {
      console.log('Updating column title from:', this.columns[index].title, 'to:', newTitle);
      this.columns[index].title = newTitle;
      
      if (this.tableConfig?.columns) {
        const columnInConfig = this.tableConfig.columns.find(col => col.field === this.columns[index].field);
        console.log('Found column in config:', columnInConfig);
        if (columnInConfig && (columnInConfig as any)._id) {
          console.log('Calling updateColumn with ID:', (columnInConfig as any)._id, 'title:', newTitle);
          this.todosService.updateColumn((columnInConfig as any)._id, {
            ...columnInConfig,
            title: newTitle
          }).subscribe({
            next: (updatedConfig) => {
              console.log('Header updated successfully in database:', updatedConfig);
              this.tableConfig = updatedConfig;
              this.columns = updatedConfig.columns.sort((a, b) => (a.order || 0) - (b.order || 0));
              this.cdr.detectChanges();
            },
            error: (err) => {
              console.error('Failed to update header in database:', err);
              // Revert the change if database update failed
              this.columns[index].title = columnInConfig.title;
              this.cdr.detectChanges();
            }
          });
        } else {
          console.error('Column not found in config or missing _id');
        }
      }
      
      this.cdr.detectChanges();
    }
    
    this.headerEditingIndex = null;
    this.editHeaderValue = '';
    setTimeout(() => this.setupResizableColumns(), 0);
  }

  getInputValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  addNewColumn(): void {
    if (this.isAddingColumn) {
      console.log('Already adding a column, ignoring request');
      return;
    }
    
    const headerText = this.newColumnHeader.trim() || 'New Column';
    if (!headerText) {
      console.log('Empty column header, ignoring request');
      return;
    }
    
    let field = headerText.toLowerCase().replace(/[^a-z0-9_]+/g, '_');
    let suffix = 1;
    let baseField = field;
    while (this.columns.some(col => col.field === field)) {
      field = `${baseField}_${suffix++}`;
    }
    
    const newColumn: Column = {
      title: headerText,
      field: field,
      order: this.columns.length,
      editable: true
    };
    
    console.log('Adding new column:', newColumn);
    this.isAddingColumn = true;
    
    // Clear the input immediately to prevent double submission
    this.newColumnHeader = '';
    
    this.todosService.addColumn(newColumn).subscribe({
      next: (updatedConfig) => {
        console.log('Column added successfully, updating config:', updatedConfig);
        this.tableConfig = updatedConfig;
        this.columns = updatedConfig.columns.sort((a, b) => (a.order || 0) - (b.order || 0));
        
        this.todosService.updateAllTodosWithNewColumn(field).subscribe({
          next: (updatedTodos) => {
            this.todos = updatedTodos.map(todo => ({
              ...todo,
              id: todo._id || todo.id,
            }));
            console.log('All todos updated with new column');
            this.isAddingColumn = false;
            setTimeout(() => this.setupResizableColumns(), 0);
            this.cdr.detectChanges();
          },
          error: (err) => {
            console.error('Failed to update todos with new column:', err);
            this.isAddingColumn = false;
            // Don't revert the column addition since it was successful
            this.cdr.detectChanges();
          }
        });
      },
      error: (err) => {
        console.error('Failed to add column to database:', err);
        this.isAddingColumn = false;
        // Restore the input value if the operation failed
        this.newColumnHeader = headerText;
        if (err.error && err.error.includes('already exists')) {
          alert('A column with this name already exists. Please use a different name.');
        } else {
          alert('Failed to add column. Please try again.');
        }
        this.cdr.detectChanges();
      }
    });
  }

  deleteColumn(colIndex: number): void {
    if (this.columns.length <= 1) return;
    const columnToDelete = this.columns[colIndex];
    const fieldToRemove = columnToDelete.field;
    if (fieldToRemove === 'serialNo') return;
    
    console.log('Deleting column:', fieldToRemove);
    
    if (!this.tableConfig?.columns) {
      console.error('No table config found');
      return;
    }
    
    const columnInConfig = this.tableConfig.columns.find(col => col.field === fieldToRemove);
    if (!columnInConfig || !(columnInConfig as any)._id) {
      console.error('Column not found in table config');
      return;
    }
    
    this.todosService.deleteColumn((columnInConfig as any)._id).subscribe({
      next: (updatedConfig) => {
        this.tableConfig = updatedConfig;
        this.columns = updatedConfig.columns.sort((a, b) => (a.order || 0) - (b.order || 0));
        
        this.todosService.removeColumnFromAllTodos(fieldToRemove).subscribe({
          next: (updatedTodos) => {
            this.todos = updatedTodos.map(todo => ({
              ...todo,
              id: todo._id || todo.id,
            }));
            console.log('Column removed from all todos');
          },
          error: (err) => {
            console.error('Failed to remove column from todos:', err);
            this.columns.splice(colIndex, 1);
            this.todos.forEach(todo => {
              delete (todo as any)[fieldToRemove];
            });
          }
        });
        
        setTimeout(() => this.setupResizableColumns(), 0);
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Failed to delete column from database:', err);
        alert('Failed to delete column. Please try again.');
      }
    });
  }

  deleteSelectedColumn(): void {
    if (this.selectedColumnIndex !== null) {
      this.deleteColumn(this.selectedColumnIndex);
      this.selectedColumnIndex = null;
    }
  }
}
