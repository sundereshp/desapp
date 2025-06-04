import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ThemeProvider } from './contexts/ThemeContext';
import { TaskProvider } from './contexts/TaskContext';
import Navbar from './components/Navbar';
import SettingsPage from './components/SettingsPage';
import { CSSTransition } from 'react-transition-group';
import './App.css';
import './styles/animations.css';
import { Keyboard, MousePointerClick } from 'lucide-react';

// Key code mappings for display
const KEY_CODES = {
  8: 'Backspace', 9: 'Tab', 13: 'Enter', 16: 'Shift', 17: 'Ctrl', 18: 'Alt',
  19: 'Pause', 20: 'Caps Lock', 27: 'Escape', 32: 'Space', 33: 'Page Up',
  34: 'Page Down', 35: 'End', 36: 'Home', 37: 'Left Arrow', 38: 'Up Arrow',
  39: 'Right Arrow', 40: 'Down Arrow', 45: 'Insert', 46: 'Delete',
  48: '0', 49: '1', 50: '2', 51: '3', 52: '4', 53: '5', 54: '6', 55: '7', 56: '8', 57: '9',
  65: 'A', 66: 'B', 67: 'C', 68: 'D', 69: 'E', 70: 'F', 71: 'G', 72: 'H', 73: 'I',
  74: 'J', 75: 'K', 76: 'L', 77: 'M', 78: 'N', 79: 'O', 80: 'P', 81: 'Q', 82: 'R',
  83: 'S', 84: 'T', 85: 'U', 86: 'V', 87: 'W', 88: 'X', 89: 'Y', 90: 'Z',
  112: 'F1', 113: 'F2', 114: 'F3', 115: 'F4', 116: 'F5', 117: 'F6',
  118: 'F7', 119: 'F8', 120: 'F9', 121: 'F10', 122: 'F11', 123: 'F12'
};

function App() {
  const [selections, setSelections] = useState({
    project: '',
    task: '',
    subtask: '',
    action: '',
    subaction: ''
  });

  const [showTracker, setShowTracker] = useState(false);
  const [timerRunning, setTimerRunning] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const timerRef = useRef(null);
  
  const [projects, setProjects] = useState({});
  const [projectsList, setProjectsList] = useState([]); // Store projects as an array of objects with id and name
  const [loading, setLoading] = useState(true);

  const [tasks, setTasks] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [tasksLoading, setTasksLoading] = useState(false);
  const [allTasks, setAllTasks] = useState([]); // Store all tasks

  useEffect(() => {
    const fetchAllTasks = async () => {
      try {
        setTasksLoading(true);
        const tasksResponse = await fetch('http://localhost:5000/sunderesh/backend/tasks');
        
        if (!tasksResponse.ok) {
          throw new Error('Failed to fetch tasks');
        }
        
        const tasksData = await tasksResponse.json();
        console.log('All tasks data:', tasksData);
        
        // Process tasks data - adjust this based on the actual API response structure
        if (Array.isArray(tasksData)) {
          setAllTasks(tasksData);
        } else if (tasksData.tasks && Array.isArray(tasksData.tasks)) {
          setAllTasks(tasksData.tasks);
        }
      } catch (err) {
        console.error('Error fetching tasks:', err);
      } finally {
        setTasksLoading(false);
      }
    };

    fetchAllTasks();
  }, []);

  useEffect(() => {
    if (!selectedProjectId) {
      setTasks([]);
      return;
    }

    // Find the selected project's ID from projectsList
    const selectedProject = projectsList.find(p => p.name === selectedProjectId);
    if (!selectedProject) {
      setTasks([]);
      return;
    }

    // Filter only level 1 tasks for the selected project
    const filteredTasks = allTasks.filter(task => 
      task.projectID == selectedProject.id && // Use loose equality for type safety
      task.taskLevel === 1
    );
    
    console.log('Level 1 tasks for project', selectedProjectId, ':', filteredTasks);
    setTasks(filteredTasks);
  }, [selectedProjectId, allTasks, projectsList]);

  useEffect(() => {
    console.log('Selected Project ID:', selectedProjectId);
    console.log('All tasks:', allTasks);
    
    if (!selectedProjectId) {
      console.log('No project selected, clearing tasks');
      setTasks([]);
      return;
    }

    // Find the selected project's ID from projectsList
    const selectedProject = projectsList.find(p => p.name === selectedProjectId);
    if (!selectedProject) {
      console.log('Selected project not found in projects list');
      setTasks([]);
      return;
    }

    console.log('Looking for tasks with projectID:', selectedProject.id);
    
    // Filter tasks that belong to the selected project
    const filteredTasks = allTasks.filter(task => {
      const matches = task.projectID === selectedProject.id || 
                    task.projectID?.toString() === selectedProject.id.toString() && task.level === 1;
      console.log(`Task: ${task.name}, ProjectID: ${task.projectID}, Matches: ${matches}`);
      return matches;
    });
    
    console.log('Filtered tasks for project', selectedProjectId, ':', filteredTasks);
    setTasks(filteredTasks);
  }, [selectedProjectId, allTasks, projectsList]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch projects
        const projectsResponse = await fetch('http://localhost:5000/sunderesh/backend/projects');
        if (!projectsResponse.ok) {
          throw new Error('Failed to fetch projects');
        }
        const projectsData = await projectsResponse.json();
        console.log('Projects data:', projectsData);
        
        // Process projects data
        const projectsMap = {};
        const projectsArray = [];
        
        if (Array.isArray(projectsData)) {
          projectsData.forEach(project => {
            if (project && project.id && project.name) {
              projectsMap[project.name] = {};
              projectsArray.push({
                id: project.id,
                name: project.name
              });
            }
          });
        } 
        
        console.log('Processed projects:', projectsMap);
        setProjects(projectsMap);
        setProjectsList(projectsArray);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching projects:', err);
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const startTimer = async () => {
    if (!timerRunning) {
      setShowTracker(true);
      setTimerRunning(true);
      const startTime = Date.now() - elapsedTime;
      timerRef.current = setInterval(() => {
        setElapsedTime(Date.now() - startTime);
      }, 1000);
  
      // Set tracking context before starting
      const selectedProject = projectsList.find(p => p.name === selections.project);
      const selectedTask = tasks.find(t => t.name === selections.task);
      
      if (selectedProject && selectedTask) {
        await window.electronAPI.setTrackingContext({
          projectID: selectedProject.id,
          userID: 1, // Set appropriate user ID
          taskID: selectedTask.id,
          subtaskID: selections.subtask ? tasks.find(t => t.name === selections.subtask).id : null,
          actionItemID: selections.action ? tasks.find(t => t.name === selections.action).id : null,
          subactionItemID: selections.subaction ? tasks.find(t => t.name === selections.subaction).id : null
        });
      }
  
      // Start tracking
      if (!isTracking) {
        try {
          await handleStartTracking();
        } catch (err) {
          setError(`Failed to start tracking: ${err.message}`);
          stopTimer();
        }
      }
    }
  };

  const stopTimer = async () => {
    clearInterval(timerRef.current);
    setTimerRunning(false);
  
    // Pause tracking but stay on timer page
    if (isTracking) {
      try {
        await handlePauseTracking();
      } catch (err) {
        setError(`Failed to pause tracking: ${err.message}`);
      }
    }
  };
  
  const pauseTimer = async () => {
    clearInterval(timerRef.current);
    setTimerRunning(false);
    
    // Pause tracking but stay on timer page
    if (isTracking) {
      try {
        await handlePauseTracking();
      } catch (err) {
        setError(`Failed to pause tracking: ${err.message}`);
      }
    }
  };

  const resetTimerAndBackToSelection = async () => {
    // Stop the timer and tracking
    clearInterval(timerRef.current);
    setTimerRunning(false);
    setShowTracker(false);  // This will take us back to the selection page

    // Reset timer and stats
    setElapsedTime(0);
    setEvents([]);

    // Stop tracking if it's active
    if (isTracking) {
      try {
        await handleStopTracking();
      } catch (err) {
        setError(`Failed to stop tracking: ${err.message}`);
      }
    }
  };
  // Format time for display
  const formatTime = (milliseconds) => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleProjectSelect = (projectId) => {
    setSelectedProjectId(projectId);
    // Clear previous tasks when selecting a new project
    setTasks([]);
  };

  const handleSelectionChange = (level, value) => {
    if (level === 'project') {
      handleProjectSelect(value);
    }
    
    setSelections(prev => {
      const newSelections = { ...prev, [level]: value };
      // Clear all dependent selections when a parent changes
      const levels = ['project', 'task', 'subtask', 'action', 'subaction'];
      const currentIndex = levels.indexOf(level);
      levels.slice(currentIndex + 1).forEach(l => {
        newSelections[l] = '';
      });
      return newSelections;
    });
  };

  // Get available options based on current selections with proper level filtering
  const getOptions = (level) => {
    try {
      switch (level) {
        case 'project':
          return projectsList.map(p => ({
            name: p.name,
            id: p.id
          }));

        case 'task':
          // Explicitly filter for level 1 tasks as an extra safety measure
          const level1Tasks = tasks.filter(task => task.taskLevel === 1);
          console.log('Level 1 tasks for dropdown:', level1Tasks);
          return level1Tasks.map(task => ({
            name: task.name,
            id: task.id
          }));

        case 'subtask':
          if (!selections.task) return [];
          const selectedTask = tasks.find(t => t.name === selections.task);
          if (!selectedTask) return [];
          
          // Only show level 2 tasks that are children of the selected task
          return allTasks.filter(task => 
            task.taskLevel === 2 && 
            task.parentID == selectedTask.id // Loose equality for type safety
          ).map(task => ({
            name: task.name,
            id: task.id
          }));

        case 'action':
          if (!selections.subtask) return [];
          const selectedSubtask = allTasks.find(t => t.name === selections.subtask);
          if (!selectedSubtask) return [];
          
          // Only show level 3 tasks that are children of the selected subtask
          return allTasks.filter(task => 
            task.taskLevel === 3 && 
            task.parentID == selectedSubtask.id
          ).map(task => ({
            name: task.name,
            id: task.id
          }));

        case 'subaction':
          if (!selections.action) return [];
          const selectedAction = allTasks.find(t => t.name === selections.action);
          if (!selectedAction) return [];
          
          // Only show level 4 tasks that are children of the selected action
          return allTasks.filter(task => 
            task.taskLevel === 4 && 
            task.parentID == selectedAction.id
          ).map(task => ({
            name: task.name,
            id: task.id
          }));

        default:
          return [];
      }
    } catch (error) {
      console.error('Error in getOptions:', error);
      return [];
    }
  };
  const [isTracking, setIsTracking] = useState(false);
  const [events, setEvents] = useState([]);
  const [error, setError] = useState(null);
  const eventsEndRef = useRef(null);
  const [isElectron, setIsElectron] = useState(false);
  const [apiReady, setApiReady] = useState(false);

  const maxEvents = 1000;
  const [screenshotInterval, setScreenshotInterval] = useState(null);
  const [lastScreenshot, setLastScreenshot] = useState(null);

  // Calculate stats from events array
  const stats = useMemo(() => {
    const calculatedStats = { mouseClicks: 0, keyPresses: 0, mouseMoves: 0 };

    events.forEach(event => {
      try {
        if (!event || typeof event !== 'object') {
          console.warn('Invalid event object:', event);
          return;
        }

        if (!event.type) {
          console.warn('Event missing type property:', event);
          return;
        }

        switch (event.type) {
          case 'mouseclick':
            calculatedStats.mouseClicks++;
            break;
          case 'keydown':
            calculatedStats.keyPresses++;
            break;
          case 'mousemove':
            calculatedStats.mouseMoves++;
            break;
          default:
            console.log('Unhandled event type:', event.type, 'event:', event);
        }
      } catch (error) {
        console.error('Error processing event:', error, 'Event:', event);
      }
    });

    return calculatedStats;
  }, [events]);
  useEffect(() => {
    if (isTracking) {
      // Take initial screenshot immediately
      if (window.electronAPI?.takeScreenshot) {
        window.electronAPI.takeScreenshot().then(result => {
          if (result.success) {
            console.log('Initial screenshot taken:', result.path);
            setLastScreenshot(result);
          } else {
            console.error('Failed to take initial screenshot:', result.error);
          }
        });
      }

      // Set up interval for subsequent screenshots
      const interval = setInterval(() => {
        if (window.electronAPI?.takeScreenshot) {
          window.electronAPI.takeScreenshot().then(result => {
            if (result.success) {
              console.log('Screenshot taken:', result.path);
              setLastScreenshot(result);
            } else {
              console.error('Failed to take screenshot:', result.error);
            }
          });
        }
      }, 300000); // 5 minutes (300,000 ms)

      setScreenshotInterval(interval);
    } else if (screenshotInterval) {
      // Clear the interval when tracking stops
      clearInterval(screenshotInterval);
      setScreenshotInterval(null);
    }

    // Clean up on unmount
    return () => {
      if (screenshotInterval) {
        clearInterval(screenshotInterval);
      }
    };
  }, [isTracking]);
  useEffect(() => {
    if (window.electronAPI) {
      setIsElectron(true);
      setApiReady(true);
      console.log('Electron API is available');
    } else {
      setApiReady(true); // Still render UI
      console.warn('Electron API is not available');
    }
  }, []);

  useEffect(() => {
    if (!apiReady || !isElectron || !window.electronAPI?.onGlobalEvent) return;

    // In App.js, update the handleGlobalEvent function
    const handleGlobalEvent = (data) => {
      try {
        console.log('Raw event data received:', JSON.stringify(data, null, 2));

        if (!data || typeof data !== 'object') {
          console.error('Invalid event data received:', data);
          return;
        }

        const newEvent = {
          ...data,
          id: Date.now() + Math.random().toString(36).substr(2, 9),
          timestamp: new Date().toISOString()
        };

        console.log('Processed new event:', newEvent);

        setEvents(prev => {
          const updatedEvents = [...prev, newEvent].slice(-maxEvents);
          console.log('Total events in state:', updatedEvents.length);
          return updatedEvents;
        });
      } catch (error) {
        console.error('Error in handleGlobalEvent:', error, 'Data:', data);
      }
    };

    const cleanup = window.electronAPI.onGlobalEvent(handleGlobalEvent);
    return () => {
      if (typeof cleanup === 'function') cleanup();
      else if (window.electronAPI?.removeGlobalEventListener) {
        window.electronAPI.removeGlobalEventListener(handleGlobalEvent);
      }
    };
  }, [isElectron, apiReady, maxEvents]);

  useEffect(() => {
    if (!isElectron || !window.electronAPI) return;

    const cleanupTrackingStatus = window.electronAPI.onTrackingStatus((data) => {
      setIsTracking(data.isTracking);
    });

    const cleanupTrackingError = window.electronAPI.onTrackingError((data) => {
      setError(data.error);
    });

    // Initial status check
    window.electronAPI.getTrackingStatus().then((status) => {
      setIsTracking(status.isTracking);
    });

    return () => {
      cleanupTrackingStatus();
      cleanupTrackingError();
    };
  }, [isElectron]);

  useEffect(() => {
    if (eventsEndRef.current) {
      const eventsContainer = eventsEndRef.current.parentElement;
      if (eventsContainer) {
        eventsContainer.scrollTop = eventsContainer.scrollHeight;
      }
    }
  }, [events]);

  const handleStartTracking = async () => {
    try {
      const result = await window.electronAPI.startTracking();
      if (result.success) {
        setError(null);
      }
    } catch (err) {
      setError(`Failed to start tracking: ${err.message}`);
    }
  };

  const handlePauseTracking = async () => {
    try {
      const result = await window.electronAPI.stopTracking();
      if (result.success) {
        setError(null);
        
        // Don't set isTracking to false, just keep it true but paused
      }
    } catch (err) {
      setError(`Failed to pause tracking: ${err.message}`);
    }
  };

  const handleStopTracking = async () => {
    try {
      const result = await window.electronAPI.stopTracking();
      if (result.success) {
        setError(null);
      }
    } catch (err) {
      setError(`Failed to stop tracking: ${err.message}`);
    }
  };

  const clearEvents = () => {
    setEvents([]);
  };

  const formatEvent = (event) => {
    const time = new Date(event.timestamp).toLocaleTimeString();

    switch (event.type) {
      case 'mouseclick':
        const buttonName = event.button === 1 ? 'Left' :
          event.button === 2 ? 'Right' :
            event.button === 3 ? 'Middle' : 'Unknown';
        return `${time} - Mouse ${buttonName} Click at (${event.x}, ${event.y})`;

      case 'mousemove':
        return `${time} - Mouse Move to (${event.x}, ${event.y})`;

      case 'keydown':
        const keyName = KEY_CODES[event.keycode] || `Key[${event.keycode}]`;
        return `${time} - Key Down: ${keyName}`;

      default:
        return `${time} - ${event.type}: ${JSON.stringify(event)}`;
    }
  };

  const [showSettings, setShowSettings] = useState(false);

  const handleSettingsClick = () => {
    setShowSettings(prev => !prev);
  };

  const handleBackFromSettings = () => {
    setShowSettings(false);
  };

  const handleQuitClick = () => {
    if (window.electron) {
      window.electron.quitApp();
    } else {
      console.log('Quit clicked');
    }
  };

  const renderSelectionUI = () => {
    return (
      <div className="selection-container">
        <h2>Task Selection</h2>
        <div className="dropdown-group">
          <select
            value={selections.project}
            onChange={(e) => handleSelectionChange('project', e.target.value)}
            className="dropdown"
          >
            <option value="">Select Project</option>
            {projectsList.map(project => (
              <option key={project.id} value={project.name}>
                {project.name}
              </option>
            ))}
          </select>

          {selections.project && (
            <select
              value={selections.task}
              onChange={(e) => handleSelectionChange('task', e.target.value)}
              className="dropdown"
            >
              <option value="">
                {tasksLoading ? 'Loading tasks...' : getOptions('task').length === 0 ? 'No tasks found' : 'Select Task'}
              </option>
              {getOptions('task').map(task => (
                <option key={task.id} value={task.name}>
                  {task.name}
                </option>
              ))}
            </select>
          )}

          {selections.task && (
            <select
              value={selections.subtask}
              onChange={(e) => handleSelectionChange('subtask', e.target.value)}
              className="dropdown"
            >
              <option value="">
                {getOptions('subtask').length === 0 ? 'No subtasks available' : 'Select Subtask'}
              </option>
              {getOptions('subtask').map(subtask => (
                <option key={subtask.id} value={subtask.name}>
                  {subtask.name}
                </option>
              ))}
            </select>
          )}

          {selections.subtask && (
            <select
              value={selections.action}
              onChange={(e) => handleSelectionChange('action', e.target.value)}
              className="dropdown"
            >
              <option value="">
                {getOptions('action').length === 0 ? 'No action items available' : 'Select Action'}
              </option>
              {getOptions('action').map(action => (
                <option key={action.id} value={action.name}>
                  {action.name}
                </option>
              ))}
            </select>
          )}

          {selections.action && (
            <select
              value={selections.subaction}
              onChange={(e) => handleSelectionChange('subaction', e.target.value)}
              className="dropdown"
            >
              <option value="">
                {getOptions('subaction').length === 0 ? 'No subaction items available' : 'Select Subaction'}
              </option>
              {getOptions('subaction').map(subaction => (
                <option key={subaction.id} value={subaction.name}>
                  {subaction.name}
                </option>
              ))}
            </select>
          )}

          <button
            onClick={startTimer}
            disabled={!selections.project || !selections.task}
            className="start-timer-btn"
          >
            Start Timer
          </button>
        </div>
      </div>
    );
  };

  const renderTimerUI = () => {
    const isDarkMode = document.body.classList.contains('dark-theme');
    
    return (
      <div className="tracker-container">
        <button
          onClick={resetTimerAndBackToSelection}
          className="back-button"
          title="Go back to selection"
        >
          Back
        </button>
        <div className="timer-display">
          <h2>Time Tracking {!timerRunning && isTracking ? '(Paused)' : ''}</h2>
          <div className={`time ${!timerRunning && isTracking ? 'paused' : ''}`}>
            {formatTime(elapsedTime)}
          </div>
          
          {/* Updated Activity Metrics */}
          <div className="activity-metrics">
            <h3 className="metrics-title">Activity Metrics</h3>
            <div className="metrics-grid">
              <div className={`metric-card ${isDarkMode ? 'keyboard-dark' : 'keyboard-light'}`}>
                <div className={`metric-icon ${isDarkMode ? 'keyboard-icon-dark' : 'keyboard-icon-light'}`}>
                  <Keyboard className="metric-svg" />
                </div>
                <div className="metric-details">
                  <p className="metric-label">Keystrokes</p>
                  <p className={`metric-value ${isDarkMode ? 'keyboard-text-dark' : 'keyboard-text-light'}`}>
                    {stats.keyPresses || 0}
                  </p>
                </div>
              </div>
              
              <div className={`metric-card ${isDarkMode ? 'mouse-dark' : 'mouse-light'}`}>
                <div className={`metric-icon ${isDarkMode ? 'mouse-icon-dark' : 'mouse-icon-light'}`}>
                  <MousePointerClick className="metric-svg" />
                </div>
                <div className="metric-details">
                  <p className="metric-label">Mouse Clicks</p>
                  <p className={`metric-value ${isDarkMode ? 'mouse-text-dark' : 'mouse-text-light'}`}>
                    {stats.mouseClicks || 0}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="selection-info">
            <p>
              {[
                selections.project,
                selections.task,
                selections.subtask,
                selections.action,
                selections.subaction
              ]
                .filter(Boolean) // Remove any falsy values
                .map((item, index, array) => (
                  <span key={index}>
                    <strong>{item}</strong>
                    {index < array.length - 1 && ' → '}
                  </span>
                ))}
            </p>
          </div>
        </div>

        <div className="controls">
          {timerRunning ? (
            <button
              onClick={pauseTimer}
              className="stop-btn"
              disabled={!!error && error.includes('Electron API not available')}
            >
              Pause
            </button>
          ) : (
            <button
              onClick={startTimer}
              className="start-btn"
              disabled={!!error && error.includes('Electron API not available')}
            >
              Resume
            </button>
          )}

          <button
            onClick={resetTimerAndBackToSelection}
            className="reset-all-btn"
            disabled={!isTracking && events.length === 0}
          >
            Punch Out
          </button>

          
        </div>
        {/* Rest of the timer UI remains the same */}
        {error && (
          <div className="error">
            <strong>⚠️ Error:</strong> {error}
          </div>
        )}
        {/* Last Screenshot Section */}
        <div className="screenshot-section">
          <div className="screenshot-card">
            <h3>📸 Last Screenshot</h3>
            <div className="screenshot-container">
              {lastScreenshot ? (
                <img
                  src={`file://${lastScreenshot.path}`}
                  alt="Last screenshot"
                  className="screenshot-image"
                />
              ) : (
                <p className="no-screenshot">No screenshot available</p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <ThemeProvider>
      <TaskProvider>
        <div className="app">
          <Navbar
            title={showSettings ? 'Settings' : (showTracker ? 'Timer' : 'Selection')}
            onSettingsClick={handleSettingsClick}
            onQuitClick={handleQuitClick}
          />

          <CSSTransition
            in={!showSettings}
            timeout={300}
            classNames="slide"
            unmountOnExit
          >
            <div className="main-content">
              {!showTracker ? renderSelectionUI() : renderTimerUI()}
            </div>
          </CSSTransition>

          <CSSTransition
            in={showSettings}
            timeout={300}
            classNames="slide"
            unmountOnExit
          >
            <div className="settings-container">
              <SettingsPage
                onBackClick={handleBackFromSettings}
                onQuitClick={handleQuitClick}
              />
            </div>
          </CSSTransition>
        </div>
      </TaskProvider>
    </ThemeProvider>
  );
}

export default App;