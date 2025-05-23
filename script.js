// Global Variables and DOM Element References
const taskNameInput = document.getElementById('task-name');
const taskDueTimeInput = document.getElementById('task-due-time');
const addTaskBtn = document.getElementById('add-task-btn');
const taskListUl = document.getElementById('task-list');
const filterAllBtn = document.getElementById('filter-all');
const filterActiveBtn = document.getElementById('filter-active');
const filterCompletedBtn = document.getElementById('filter-completed');
const themeToggleBtn = document.getElementById('theme-toggle');

let tasks = [];
let currentFilter = 'all'; // To keep track of the current filter

const LOCAL_STORAGE_KEY = 'taskList';

// --- LocalStorage Functions ---
function saveTasks() {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(tasks));
}

function loadTasks() {
    const storedTasks = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (storedTasks) {
        tasks = JSON.parse(storedTasks);
    } else {
        tasks = []; // Initialize if nothing is stored
    }
}

// --- Render Tasks Function ---
function renderTasks(filter = 'all') {
    taskListUl.innerHTML = ''; // Clear current tasks

    let filteredTasks = tasks;
    if (filter === 'active') {
        filteredTasks = tasks.filter(task => !task.completed);
    } else if (filter === 'completed') {
        filteredTasks = tasks.filter(task => task.completed);
    }

    filteredTasks.forEach(task => {
        const li = document.createElement('li');
        li.dataset.id = task.id;
        li.draggable = true; // Make task item draggable

        // Drag event listeners for the task item
        li.addEventListener('dragstart', handleDragStart);
        li.addEventListener('dragend', handleDragEnd);

        if (task.completed) {
            li.classList.add('completed');
        } else if (task.dueTime) { // Only check for overdue if not completed and has due time
            const now = new Date();
            const dueDate = new Date();
            const [hours, minutes] = task.dueTime.split(':');
            dueDate.setHours(hours, minutes, 0, 0); // Set hours, minutes, seconds, ms

            if (now > dueDate) {
                li.classList.add('overdue');
            }
        }

        // Checkbox for completion
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = task.completed;
        checkbox.addEventListener('change', () => toggleTaskCompletion(task.id));

        // Task Name Span
        const taskNameSpan = document.createElement('span');
        taskNameSpan.textContent = task.name;
        taskNameSpan.classList.add('task-name-span');


        // Due Time Span
        const dueTimeSpan = document.createElement('span');
        dueTimeSpan.classList.add('due-time-span');
        if (task.dueTime) {
            dueTimeSpan.textContent = ` (Due: ${task.dueTime})`;
        }

        // Edit Button
        const editBtn = document.createElement('button');
        editBtn.textContent = 'Edit';
        editBtn.classList.add('edit-btn');
        editBtn.addEventListener('click', () => handleEditTask(task.id, li));

        // Delete Button
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Delete';
        deleteBtn.classList.add('delete-btn');
        deleteBtn.addEventListener('click', () => deleteTask(task.id));

        li.appendChild(checkbox);
        li.appendChild(taskNameSpan);
        li.appendChild(dueTimeSpan);
        li.appendChild(editBtn);
        li.appendChild(deleteBtn);

        taskListUl.appendChild(li);
    });
}

// --- Drag and Drop Handlers ---
let draggedItemId = null; // To store the ID of the item being dragged

function handleDragStart(event) {
    draggedItemId = event.target.dataset.id;
    event.dataTransfer.setData('text/plain', draggedItemId);
    event.target.classList.add('dragging'); // Optional: for visual feedback
}

function handleDragEnd(event) {
    event.target.classList.remove('dragging'); // Optional: remove visual feedback
    draggedItemId = null; // Reset
}

// Add dragover and drop listeners to the list itself
taskListUl.addEventListener('dragover', handleDragOver);
taskListUl.addEventListener('drop', handleDrop);

function handleDragOver(event) {
    event.preventDefault(); // Necessary to allow dropping
    // Optional: Add visual feedback for where the item will be dropped
    const draggingElement = document.querySelector('.dragging');
    if (!draggingElement) return;

    const afterElement = getDragAfterElement(taskListUl, event.clientY);
    if (afterElement == null) {
        taskListUl.appendChild(draggingElement);
    } else {
        taskListUl.insertBefore(draggingElement, afterElement);
    }
}

function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('li:not(.dragging)')];

    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}


function handleDrop(event) {
    event.preventDefault();
    const droppedItemId = event.dataTransfer.getData('text/plain');
    if (!droppedItemId) return;

    const draggedTaskIndex = tasks.findIndex(task => task.id.toString() === droppedItemId);
    if (draggedTaskIndex === -1) return;

    const draggedTask = tasks[draggedTaskIndex];

    // Determine the target element and its index
    let targetElement = event.target;
    while (targetElement && targetElement.tagName !== 'LI') {
        targetElement = targetElement.parentElement;
    }

    let newIndex;
    if (targetElement && targetElement.dataset.id !== droppedItemId) {
        const targetTaskIndex = tasks.findIndex(task => task.id.toString() === targetElement.dataset.id);
        if (targetTaskIndex === -1) { // Dropped in an empty area or on non-task item
             newIndex = tasks.length; // Append to end
        } else {
            // Decide before or after based on drop position relative to targetElement's midpoint
            const rect = targetElement.getBoundingClientRect();
            const isAfter = event.clientY > rect.top + rect.height / 2;
            newIndex = isAfter ? targetTaskIndex + 1 : targetTaskIndex;
        }
    } else if (!targetElement) { // Dropped in an empty area of the list
        newIndex = tasks.length;
    } else { // Dropped on itself or invalid target, keep original position temporarily
        newIndex = draggedTaskIndex; // This case should ideally not change order
    }
    
    // If dropped on itself (or no valid move), newIndex might equal draggedTaskIndex
    // or if it's moved to the position right after itself (when moving down)
    // we need to adjust.
    // More robustly: remove first, then insert.

    tasks.splice(draggedTaskIndex, 1); // Remove the dragged task

    // Adjust newIndex if the removal shifted subsequent elements
    if (targetElement && targetElement.dataset.id !== droppedItemId) {
        // Re-calculate targetIndex based on the modified array if necessary
        // This is tricky. A simpler way: find where the target element *is now*
        // Or, if we placed it visually during dragover, use that structure.
        // For now, we assume the newIndex calculation relative to original was okay,
        // but need to be careful if newIndex was after draggedTaskIndex.
        
        // Let's refine newIndex calculation for insertion
        // The newIndex should be based on the visual position from getDragAfterElement
        const afterElement = getDragAfterElement(taskListUl, event.clientY);
        if (afterElement == null) { // Dropped at the end
            newIndex = tasks.length;
        } else {
            const afterElementId = afterElement.dataset.id;
            newIndex = tasks.findIndex(task => task.id.toString() === afterElementId);
        }
         // If dragged item was before the target, and target moved up, index is fine
        // If dragged item was after the target, and target moved down, index needs adjustment.
        // This is simpler if we just use the visual drop position.
    } else if (!targetElement) { // Dropped in empty area
        newIndex = tasks.length;
    }
    // If dropped on itself, it was removed, so adding it back at tasks.length
    // or its original spot (if no other elements) effectively means no change or append.

    tasks.splice(newIndex, 0, draggedTask); // Insert at new position

    saveTasks();
    renderTasks(currentFilter); // Re-render to reflect the new order
}

// --- Add New Task ---
addTaskBtn.addEventListener('click', () => {
    const taskName = taskNameInput.value.trim();
    const dueTime = taskDueTimeInput.value;

    if (taskName) {
        const newTask = {
            id: Date.now(),
            name: taskName,
            dueTime: dueTime,
            completed: false
        };
        tasks.push(newTask);
        saveTasks(); // Save after adding
        taskNameInput.value = '';
        taskDueTimeInput.value = '';
        renderTasks(currentFilter);
    } else {
        alert('Task name cannot be empty!');
    }
});

// --- Mark Tasks as Completed ---
function toggleTaskCompletion(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (task) {
        task.completed = !task.completed;
        saveTasks(); // Save after toggling completion
        renderTasks(currentFilter);
    }
}

// --- Edit Tasks ---
function handleEditTask(taskId, listItem) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const taskNameSpan = listItem.querySelector('.task-name-span');
    const currentName = task.name;

    // Create input field for editing
    const editInput = document.createElement('input');
    editInput.type = 'text';
    editInput.value = currentName;
    editInput.classList.add('edit-input'); // For potential styling

    // Create Save button
    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'Save';
    saveBtn.classList.add('save-btn');

    // Replace span with input and Save button
    taskNameSpan.replaceWith(editInput, saveBtn);
    editInput.focus(); // Focus the input field

    saveBtn.addEventListener('click', () => {
        const newName = editInput.value.trim();
        if (newName) {
            task.name = newName;
            saveTasks(); // Save after editing name
            renderTasks(currentFilter); // Re-render to show updated name and remove input
        } else {
            // If new name is empty, revert to original or handle as an error
            // For simplicity, we'll re-render, which will put back the original span
            renderTasks(currentFilter);
        }
    });

    // Optional: Handle Enter key to save
    editInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            saveBtn.click();
        }
    });

    // Optional: Handle blur to cancel or save (more complex, for now click Save)
    // editInput.addEventListener('blur', () => {
    //    renderTasks(currentFilter); // This would cancel edit if not saved
    // });
}


// --- Delete Tasks ---
function deleteTask(taskId) {
    tasks = tasks.filter(t => t.id !== taskId);
    saveTasks(); // Save after deleting
    renderTasks(currentFilter);
}

// --- Filter Event Listeners ---
filterAllBtn.addEventListener('click', () => {
    currentFilter = 'all';
    setActiveFilterButton(filterAllBtn);
    renderTasks(currentFilter);
});

filterActiveBtn.addEventListener('click', () => {
    currentFilter = 'active';
    setActiveFilterButton(filterActiveBtn);
    renderTasks(currentFilter);
});

filterCompletedBtn.addEventListener('click', () => {
    currentFilter = 'completed';
    setActiveFilterButton(filterCompletedBtn);
    renderTasks(currentFilter);
});

function setActiveFilterButton(activeButton) {
    [filterAllBtn, filterActiveBtn, filterCompletedBtn].forEach(button => {
        button.classList.remove('active-filter');
    });
    activeButton.classList.add('active-filter');
}


// --- Initial Render ---
// Load tasks from local storage if available, or initialize as empty
// For now, just render empty or with sample data
// tasks = [
//     { id: 1, name: 'Example Task 1', dueTime: '12:00', completed: false },
//     { id: 2, name: 'Example Task 2', dueTime: '15:30', completed: true }
// ];

// --- Theme Preference Variables ---
const THEME_KEY = 'themePreference';

// --- Theme Functions ---
function applyTheme(theme) {
    if (theme === 'dark') {
        document.body.classList.add('dark-mode');
    } else {
        document.body.classList.remove('dark-mode');
    }
}

function toggleTheme() {
    const currentTheme = document.body.classList.contains('dark-mode') ? 'dark' : 'light';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    applyTheme(newTheme);
    localStorage.setItem(THEME_KEY, newTheme);
}

function loadTheme() {
    const savedTheme = localStorage.getItem(THEME_KEY);
    if (savedTheme) {
        applyTheme(savedTheme);
    } else {
        // Optional: Check for system preference if no saved theme
        // if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        //     applyTheme('dark');
        // } else {
        //     applyTheme('light'); // Default to light if no preference
        // }
        applyTheme('light'); // Default to light theme if nothing is saved
    }
}

// --- Event Listener for Theme Toggle ---
if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', toggleTheme);
}


// --- Initial Load and Render ---
document.addEventListener('DOMContentLoaded', () => {
    loadTasks(); // Load tasks from localStorage
    loadTheme(); // Load and apply saved theme
    setActiveFilterButton(filterAllBtn); // Set 'All' as active by default
    renderTasks(currentFilter); // Render the loaded tasks
});
