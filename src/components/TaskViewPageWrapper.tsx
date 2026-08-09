import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { Task } from '../types';

interface TaskViewPageWrapperProps {
  tasks: Task[];
  onViewTask: (task: Task) => void;
}

export const TaskViewPageWrapper: React.FC<TaskViewPageWrapperProps> = ({ tasks, onViewTask }) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    if (id) {
      const task = tasks.find(t => t.id === Number(id));
      if (task) {
        onViewTask(task);
      }
      navigate('/tasks', { replace: true });
    }
  }, [id, tasks, onViewTask, navigate]);

  return null;
};
