# Accord 360 Testing Checklist

Use the demo accounts in `README.md`. Tick each item after testing.

## A. Startup

- [ ] Backend opens at `http://localhost:8000`
- [ ] Swagger opens at `http://localhost:8000/docs`
- [ ] Frontend opens at `http://localhost:5173` or Docker URL `http://localhost:8080`
- [ ] Mobile layout works at widths around 375 px and 430 px
- [ ] Sidebar opens and closes on mobile

## B. Authentication

- [ ] Administrator can log in
- [ ] Researcher can log in
- [ ] Approver can log in
- [ ] Linkages officer can log in
- [ ] Legal reviewer can log in
- [ ] Executive can log in
- [ ] Wrong password is rejected
- [ ] Logout clears the session

## C. Partners

- [ ] Open Partners
- [ ] Add a new partner
- [ ] Partner appears in the registry
- [ ] Duplicate partner name is rejected

## D. Agreement request

- [ ] Log in as researcher
- [ ] Create a new MoU request
- [ ] Unique reference number is generated
- [ ] Request appears only in the researcher's agreement list
- [ ] Open agreement details
- [ ] Submit the request

## E. Workflow roles

- [ ] Approver can approve the departmental stage
- [ ] Linkages can route the request to Legal
- [ ] Legal can approve the draft
- [ ] Linkages can send the agreement for signing
- [ ] Linkages can mark the agreement fully signed
- [ ] Activation fails when required fields are missing
- [ ] Fill effective date, expiry date, champion and partner liaison
- [ ] Activation succeeds
- [ ] Workflow history shows each action, actor and time
- [ ] Invalid role or invalid-stage action is blocked

## F. Documents

- [ ] Upload a PDF or Word document
- [ ] Uploaded file appears in the repository
- [ ] File opens from the repository
- [ ] Version and document type are displayed
- [ ] Unsupported file type is rejected
- [ ] File larger than 25 MB is rejected

## G. Monitoring and evaluation

- [ ] Add a deliverable target and actual
- [ ] Progress bar updates
- [ ] Add a financial/resource value record
- [ ] Value appears on the agreement
- [ ] Dashboard total value updates

## H. Dashboard

- [ ] Active partnership KPI is accurate
- [ ] Pipeline KPI is accurate
- [ ] At-risk KPI is accurate
- [ ] Total value KPI is accurate
- [ ] Agreement type chart displays
- [ ] Lifecycle stage chart displays
- [ ] Recent agreements open correctly

## I. Reports and administration

- [ ] CSV agreement register downloads
- [ ] Administrator can create a user
- [ ] Administrator can change a user's role
- [ ] Audit trail records creation, updates, workflow and uploads
- [ ] Notifications appear after workflow actions
- [ ] Notification can be marked read

## J. Mobile and responsive design

- [ ] Login page fits without horizontal scrolling
- [ ] Dashboard KPI cards stack correctly
- [ ] Tables convert into readable mobile record cards
- [ ] Forms use one column on small screens
- [ ] Agreement lifecycle bar can scroll horizontally
- [ ] Buttons remain large enough to tap
- [ ] Notification panel stays inside the screen

