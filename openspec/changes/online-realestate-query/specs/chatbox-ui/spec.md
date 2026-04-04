## ADDED Requirements

### Requirement: Chat message input
The system SHALL provide a text input field where users can type natural language queries about Taiwan real estate transactions. The input SHALL support Enter to submit and Shift+Enter for newline.

#### Scenario: User submits a query
- **WHEN** user types a query in the input field and presses Enter
- **THEN** the message appears in the chat history as a user message, the input clears, and a loading indicator is shown while waiting for the AI response

### Requirement: AI response display
The system SHALL display AI responses in the chat history with clear visual distinction from user messages. Responses SHALL be rendered as formatted text in Traditional Chinese.

#### Scenario: AI response appears in chat
- **WHEN** the API returns a successful AI response
- **THEN** the response is displayed in the chat history with distinct styling, and the loading indicator is removed

### Requirement: Quick query buttons
The system SHALL display preset quick-query buttons that users can click to submit common queries without typing. These buttons MUST be visible on initial load and after error responses.

#### Scenario: User clicks a quick query
- **WHEN** user clicks a quick-query button (e.g., "台北市本月成交行情")
- **THEN** the query text is submitted as if the user typed it, and the normal query flow is triggered

#### Scenario: Quick queries shown on initial load
- **WHEN** the page loads with no chat history
- **THEN** a welcome message and at least 4 quick-query buttons are displayed

### Requirement: Chat history management
The system SHALL maintain chat history for the current browser session. History SHALL NOT persist across page reloads (no server-side storage required).

#### Scenario: Messages persist during session
- **WHEN** user has sent multiple queries and received responses
- **THEN** all messages remain visible in scrollable chat history within the same session

### Requirement: Loading and disabled state
The system SHALL disable the input field and submit button while a query is being processed, and display a loading indicator.

#### Scenario: Input disabled during processing
- **WHEN** a query is being processed (waiting for API response)
- **THEN** the input field and submit button are disabled, and a loading animation is shown
