# Email Template QA System

An AI-driven email template quality assurance system with a React.js admin interface and multi-agent AI testing framework. Designed for autonomous execution by Claude Code, eliminating the need for human QA intervention.

**Live Demo:** https://email-template-qa-h2u75k6mua-uc.a.run.app

## Project Structure

```
carebox_test_task/
├── web/                                    # React.js Admin Application
│   ├── src/
│   │   ├── pages/                          # Page components
│   │   │   ├── EmailTemplates.jsx          # Template editor with live preview
│   │   │   ├── Testing.jsx                 # Test runner with pipeline progress
│   │   │   ├── TestPlans.jsx               # Test plans viewer
│   │   │   ├── Logs.jsx                    # Test logs viewer
│   │   │   ├── Reports.jsx                 # QA reports viewer
│   │   │   └── Settings.jsx                # App settings
│   │   ├── components/
│   │   │   ├── ui/                         # Shared UI components
│   │   │   │   ├── NotificationToast.jsx
│   │   │   │   ├── LoadingSpinner.jsx
│   │   │   │   ├── EmptyState.jsx
│   │   │   │   ├── StatusBadge.jsx
│   │   │   │   └── Toggle.jsx
│   │   │   ├── templates/                  # Template-related components
│   │   │   ├── settings/                   # Settings-related components
│   │   │   └── reports/                    # Report-related components
│   │   ├── constants/                      # Centralized constants
│   │   │   ├── api.js                      # API endpoints
│   │   │   ├── pipeline.js                 # Pipeline steps
│   │   │   ├── ui.js                       # UI constants (viewports, timeouts)
│   │   │   ├── status.js                   # Status colors
│   │   │   ├── templates.js                # Template metadata
│   │   │   └── files.js                    # File pattern helpers
│   │   ├── hooks/                          # Custom React hooks
│   │   │   └── useTestCompletion.js        # Auto-refresh on test completion
│   │   └── i18n/                           # Internationalization
│   │       ├── index.js                    # i18n configuration
│   │       └── locales/en/                 # English translations
│   ├── public/
│   │   └── carebox_logo.png                # Company logo
│   ├── server.js                           # Production Express server
│   └── vite.config.js                      # Vite config with API middleware
│
├── email_templates/
│   ├── emails/                             # All email templates
│   │   ├── site_visitor_welcome.mjml           # Base template (blue)
│   │   ├── site_visitor_welcome_partner_a.mjml # Partner A (green)
│   │   └── site_visitor_welcome_partner_b.mjml # Partner B (different content)
│   └── shared/                             # Shared resources
│       ├── variables.ejs                   # Shared variable definitions
│       ├── config.json                     # Brand colors, typography config
│       ├── styles.mjml                     # Shared MJML styles
│       ├── carebox_logo.png                # Company logo
│       └── partials/                       # Reusable EJS partials
│           ├── head.ejs                    # Email head (title, preview, styles)
│           ├── header.ejs                  # Logo header section
│           ├── footer.ejs                  # Footer with links/copyright
│           ├── content-welcome.ejs         # Standard welcome message
│           ├── button-cta.ejs              # CTA button
│           └── support-note.ejs            # Support contact note
│
├── test_framework/
│   ├── agents/                             # Multi-agent AI system
│   │   ├── base-agent.js                   # Base agent with Claude API
│   │   ├── orchestrator.js                 # Agent coordinator
│   │   ├── test-planner-agent.js           # Phase 0: Test planning
│   │   ├── change-analyzer-agent.js        # Phase 1: Change analysis
│   │   ├── diff-analyzer-agent.js          # Phase 2: Template comparison
│   │   └── report-generator-agent.js       # Phase 3: Report generation
│   ├── config/
│   │   └── constants.js                    # Centralized configuration
│   ├── scripts/
│   │   ├── compile-templates.js            # MJML + EJS to HTML compilation
│   │   ├── render-with-data.js             # EJS rendering with test data
│   │   ├── validate-html.js                # HTML validation
│   │   ├── compare-templates.js            # Structural/content comparison
│   │   ├── capture-screenshots.js          # Playwright screenshots
│   │   ├── run-all-tests.js                # Main test runner
│   │   ├── run-agents.js                   # CLI entry for AI agents
│   │   ├── watch-templates.js              # File watcher for auto-testing
│   │   └── api-server.js                   # HTTP API server
│   ├── test-data/
│   │   └── sample-context.json             # Test data for EJS variables
│   ├── output/
│   │   ├── compiled/                       # Compiled HTML files
│   │   ├── screenshots/                    # Visual captures
│   │   └── test-plans/                     # Generated test plans
│   └── .env                                # Environment variables (API key)
│
├── test_reports/
│   ├── comparison-report.md                # Generated QA report
│   └── test-summary.json                   # Test execution summary
│
└── README.md
```

## Features

### Web Admin Interface
- **Live MJML Editor**: Edit templates with real-time preview using mjml-browser
- **Responsive Preview**: Switch between Desktop (1200px), Tablet (768px), and Mobile (375px) viewports
- **Template Management**: Create, duplicate, and delete templates
- **HTML View**: See compiled HTML output
- **Test Integration**: Run AI-powered tests directly from the UI
- **Auto-Refresh**: Reports, Logs, and Test Plans pages automatically refresh when tests complete
- **Cascading Delete**: Deleting a test plan, log, or report also removes linked files
- **Professional Reports**: Beautiful HTML reports with clickable issue links and screenshot viewer
- **Localization Ready**: i18n support with react-i18next

### Email Templates
- **Component-Based Architecture**: Shared partials for header, footer, buttons, etc.
- **EJS Templating**: Dynamic variables with default fallbacks
- **MJML Format**: Responsive email templates that work across all clients
- **Three Variations**:
  - Base: Blue color scheme, standard content
  - Partner A: Green color scheme, same content
  - Partner B: Blue colors, different content with extra sections

### Multi-Agent AI Testing System
Four specialized AI agents powered by Claude API:

| Agent | Phase | Purpose |
|-------|-------|---------|
| Test Planner | 0 | Analyzes task requirements, creates test plans and test cases |
| Change Analyzer | 1 | Detects file system changes, identifies modified templates |
| Diff Analyzer | 2 | Compares templates, detects color/content/structural differences |
| Report Generator | 3 | Creates comprehensive markdown reports with recommendations |

### Professional QA Reports

Reports are generated with a modern, professional design:

- **Executive Summary** with overall status badge (PASSED/WARNING/FAILED)
- **Metrics Table** showing templates tested, test cases, issues found
- **Test Case Matrix** with pass/fail status for each test
- **Template Comparison Results** for Partner A (styling) and Partner B (content)
- **Clickable Issue Links** that open a screenshot viewer panel
- **Actionable Recommendations** for fixing identified issues

Report features:
- Modern gradient header with status indicator
- Styled tables with hover effects
- Card-like list items
- Syntax-highlighted code blocks
- Responsive design

### Three Ways to Run Tests
1. **Web UI**: Click "Run Tests" button in the Test Panel
2. **CLI**: `cd test_framework && node scripts/run-agents.js`
3. **File Watcher**: `cd test_framework && node scripts/watch-templates.js` (auto-triggers on file changes)

## Running Locally (Step by Step)

### Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js 18+** - [Download](https://nodejs.org/)
- **npm** (comes with Node.js)
- **Anthropic API Key** - [Get one here](https://console.anthropic.com/)

### Step 1: Clone the Repository

```bash
git clone <repository-url>
cd carebox_test_task
```

### Step 2: Configure Environment Variables

Create a `.env` file in the `test_framework` directory with your Anthropic API key:

```bash
cd test_framework
cp .env.example .env
```

Edit the `.env` file and add your API key:

```env
ANTHROPIC_API_KEY=sk-ant-your-api-key-here
```

> **Note:** The API key is required for the AI-powered testing features. Without it, the multi-agent test system will not work.

### Step 3: Install Dependencies

Install dependencies for both the web application and test framework:

```bash
# From the project root directory
cd carebox_test_task

# Install web app dependencies
cd web
npm install

# Install test framework dependencies
cd ../test_framework
npm install

# Install Playwright browser for screenshots (optional but recommended)
npx playwright install chromium
```

### Step 4: Start the Web Application

```bash
cd web
npm run dev
```

The application will start and display a URL (typically http://localhost:5173).

Open this URL in your browser to access the Email Template QA System.

### Step 5: Explore the Web Interface

Once the app is running, you can:

| Page | URL | Description |
|------|-----|-------------|
| **Source** | `/` | View and edit MJML email templates with live preview |
| **Testing** | `/pipeline` | Run AI-powered tests and monitor progress |
| **Test Plans** | `/test-plans` | View generated test plans and test cases |
| **Logs** | `/logs` | View test execution logs |
| **Reports** | `/reports` | View QA reports with pass/fail status |
| **Settings** | `/settings` | Configure API key and auto-test settings |

### Step 6: Run Your First Test

#### Option A: From the Web UI (Recommended)

1. Navigate to the **Testing** page (`/pipeline`)
2. Select templates to test (or leave all selected)
3. Click **Run Tests**
4. Watch the progress bar as the AI agents work
5. View results in the **Reports** page

#### Option B: From Command Line

```bash
cd test_framework

# Run full AI-powered test suite
node scripts/run-agents.js

# Or run traditional test suite (compile, validate, compare)
npm test
```

#### Option C: With File Watcher (Auto-Testing)

Start the watcher to automatically run tests when templates change:

```bash
cd test_framework
node scripts/run-agents.js --watch
```

### Step 7: View Test Results

After tests complete:

1. **Reports Page** (`/reports`) - View HTML reports with detailed findings
2. **Test Plans Page** (`/test-plans`) - See generated test plans and test cases
3. **Logs Page** (`/logs`) - View execution logs for debugging

### Quick Reference: npm Scripts

#### Web Application (`web/`)

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |

#### Test Framework (`test_framework/`)

| Command | Description |
|---------|-------------|
| `npm test` | Run full test pipeline (compile, validate, compare) |
| `npm run agents` | Run multi-agent AI testing |
| `npm run agents:watch` | Run with file watcher |
| `npm run compile` | Compile MJML templates only |
| `npm run validate` | Validate HTML only |
| `npm run compare` | Compare templates only |
| `npm run screenshots` | Capture screenshots only |

### Production Mode

To run the application in production mode:

```bash
cd web

# Build the application
npm run build

# Start production server
npm start
```

The production server runs on port 8080 by default.

### Troubleshooting Setup Issues

#### "ANTHROPIC_API_KEY not found"
- Ensure you've created the `.env` file in `test_framework/`
- Check that the API key starts with `sk-ant-`
- Restart the web app after changing the `.env` file

#### Port Already in Use
- The app will automatically try the next available port
- Or specify a different port: `PORT=3000 npm run dev`

#### Dependencies Not Found
- Delete `node_modules` and `package-lock.json`, then run `npm install` again

#### Playwright Not Working
- Run `npx playwright install chromium` to install the browser
- On Linux, you may need system dependencies: `npx playwright install-deps`

## Template Architecture

### Shared Partials

Templates use EJS includes for reusable components:

```ejs
<%- include('../shared/variables') %>
<%
  const primaryColor = '#2563eb'
  const headingColor = '#1f2937'
  const bgColor = '#f4f4f5'
%>

<mjml>
  <%- include('../shared/partials/head', { title, previewText, primaryColor }) %>

  <mj-body background-color="<%= bgColor %>">
    <%- include('../shared/partials/header', { primaryColor }) %>

    <mj-section background-color="#ffffff" padding="40px 30px">
      <mj-column>
        <%- include('../shared/partials/content-welcome', { greeting, headingColor }) %>
        <%- include('../shared/partials/button-cta', { buttonText }) %>
        <%- include('../shared/partials/support-note') %>
      </mj-column>
    </mj-section>

    <%- include('../shared/partials/footer', { bgColor }) %>
  </mj-body>
</mjml>
```

### Partial Parameters

| Partial | Parameters | Description |
|---------|------------|-------------|
| `head.ejs` | `title`, `previewText`, `primaryColor` | Email head with meta, attributes, styles |
| `header.ejs` | `primaryColor` | Logo header with colored background |
| `footer.ejs` | `bgColor` | Footer with company info, links, copyright |
| `content-welcome.ejs` | `greeting`, `headingColor` | Standard welcome message (2 paragraphs) |
| `button-cta.ejs` | `buttonText` | Call-to-action button |
| `support-note.ejs` | `supportText` (optional) | Support contact information |

### Template Variations

| Template | Color Scheme | Content | Uses Shared Content |
|----------|--------------|---------|---------------------|
| Base | Blue (#2563eb) | Standard welcome | Yes |
| Partner A | Green (#16a34a) | Standard welcome | Yes |
| Partner B | Blue (#2563eb) | Custom + "What's Next?" section | Partial (button, support) |

## API Endpoints

The Vite dev server exposes these endpoints:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/templates` | GET | List all templates with metadata |
| `/api/create-template` | POST | Create new template |
| `/api/delete-template` | POST | Delete a template |
| `/api/save-template` | POST | Save template content |
| `/api/test-data` | GET | Get test context data |
| `/api/run-tests` | POST | Trigger AI agent tests |
| `/api/test-status` | GET | Check test status |
| `/api/reports` | GET | List all QA reports |
| `/api/reports/:id` | GET | Get specific report HTML |
| `/api/delete-report` | POST | Delete report (cascading) |
| `/api/logs` | GET | List all test logs |
| `/api/logs/:file` | GET | Get specific log content |
| `/api/delete-log` | POST | Delete log (cascading) |
| `/api/test-plans` | GET | List all test plans |
| `/api/delete-test-plan` | POST | Delete test plan (cascading) |
| `/api/screenshots` | GET | List available screenshots |
| `/screenshots/*` | GET | Serve screenshot images |
| `/templates/*` | GET | Serve template files (with EJS includes processed) |

**Note:** Cascading delete means deleting any linked file (test plan, log, or report) will also delete the other two files that share the same timestamp.

## Test Data

Edit `test_framework/test-data/sample-context.json` to customize test values:

```json
{
  "context": {
    "visitorName": "John Doe",
    "logoUrl": "/templates/shared/carebox_logo.png",
    "ctaUrl": "https://example.com/get-started",
    "supportEmail": "support@example.com",
    "companyName": "Carebox",
    "companyAddress": "123 Main Street, San Francisco, CA 94102",
    "privacyUrl": "https://example.com/privacy",
    "termsUrl": "https://example.com/terms",
    "unsubscribeUrl": "https://example.com/unsubscribe",
    "currentYear": "2026"
  }
}
```

## Technology Stack

### Web Application
- React 18 with Vite
- React Router for navigation
- Tailwind CSS for styling
- mjml-browser for live MJML compilation
- react-i18next for localization
- Custom hooks for state management

### Email Templates
- MJML (responsive email framework)
- EJS (embedded JavaScript templating)

### Test Framework
- Claude API (multi-agent AI system)
- Playwright (screenshot capture)
- html-validate (HTML validation)
- Chokidar (file watching)
- diff (text comparison)
- dotenv for environment configuration

## AI-Driven QA Approach

This system is designed for autonomous execution by Claude Code:

1. **Multi-Agent Architecture**: Specialized agents for different testing phases
2. **No Human-in-the-Loop**: All tests run end-to-end without manual verification
3. **LLM-Executable Scripts**: All scripts are CLI-executable with JSON output
4. **Automated Analysis**: Template differences are automatically categorized and assessed
5. **Structured Output**: All results in JSON/Markdown format for programmatic consumption

### Agent Workflow

```
┌─────────────────┐     ┌──────────────────┐     ┌────────────────┐     ┌───────────────────┐
│  Test Planner   │────▶│ Change Analyzer  │────▶│ Diff Analyzer  │────▶│ Report Generator  │
│   (Phase 0)     │     │    (Phase 1)     │     │   (Phase 2)    │     │    (Phase 3)      │
└─────────────────┘     └──────────────────┘     └────────────────┘     └───────────────────┘
       │                        │                        │                        │
       ▼                        ▼                        ▼                        ▼
   Test Plan              File Changes            Differences              Final Report
   Test Cases            Modified Files         Color/Content          Recommendations
```

## Deployment to GCP Cloud Run

### Prerequisites

- Google Cloud SDK installed and configured
- GCP project with billing enabled
- Cloud Run and Cloud Build APIs enabled

### Quick Deploy with Cloud Build

```bash
# Set your project
gcloud config set project YOUR_PROJECT_ID

# Enable required APIs
gcloud services enable cloudbuild.googleapis.com run.googleapis.com

# Deploy
gcloud builds submit --config=cloudbuild.yaml \
  --substitutions=_SERVICE_NAME=email-template-qa,_REGION=us-central1
```

### Manual Deploy

```bash
# Build Docker image
docker build -t gcr.io/YOUR_PROJECT_ID/email-template-qa .

# Push to Container Registry
docker push gcr.io/YOUR_PROJECT_ID/email-template-qa

# Deploy to Cloud Run
gcloud run deploy email-template-qa \
  --image gcr.io/YOUR_PROJECT_ID/email-template-qa \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --memory 1Gi
```

### Environment Variables

Set in Cloud Run service:

| Variable | Description | Required |
|----------|-------------|----------|
| `ANTHROPIC_API_KEY` | Anthropic API key for Claude AI | Yes |
| `NODE_ENV` | Environment (`production`) | Yes |
| `PORT` | Server port (default: 8080) | No |

### Using Secret Manager

For secure API key storage:

```bash
# Create secret
echo -n "sk-ant-your-api-key" | gcloud secrets create anthropic-api-key --data-file=-

# Deploy with secret
gcloud run deploy email-template-qa \
  --set-secrets="ANTHROPIC_API_KEY=anthropic-api-key:latest"
```

### Files for Deployment

| File | Purpose |
|------|---------|
| `Dockerfile` | Multi-stage build configuration |
| `cloudbuild.yaml` | Cloud Build CI/CD pipeline |
| `.dockerignore` | Files excluded from Docker build |
| `web/server.js` | Production Express server |
| `.env.example` | Environment variable template |

## Troubleshooting

### Logo Not Showing
Ensure the logo URL in test data points to `/templates/shared/carebox_logo.png`

### EJS Compilation Errors
The web preview converts `const`/`let` to `var` for evaluation. Check the browser console for detailed errors.

### MJML Validation Warnings
Some warnings about color attributes are expected when EJS expressions haven't been evaluated yet. The final compiled output should be valid.

## License

MIT
