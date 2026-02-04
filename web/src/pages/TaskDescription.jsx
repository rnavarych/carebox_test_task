function TaskDescription() {
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <h1 className="text-2xl font-bold text-gray-800">Test Task</h1>
        <p className="text-sm text-gray-500">AI Automation QA Engineer - Task Description</p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden bg-white">
        <iframe
          src="/test_task.html"
          className="w-full h-full border-0"
          title="Task Description"
        />
      </div>
    </div>
  )
}

export default TaskDescription
