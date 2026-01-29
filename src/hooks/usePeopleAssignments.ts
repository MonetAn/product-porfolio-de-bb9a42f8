import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PersonAssignment } from '@/lib/peopleDataManager';
import { useToast } from '@/hooks/use-toast';
import { Json } from '@/integrations/supabase/types';

// Fetch all assignments
export function usePersonAssignments() {
  return useQuery({
    queryKey: ['person_assignments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('person_initiative_assignments')
        .select('*');
      
      if (error) throw error;
      
      // Convert JSONB to typed object
      return (data || []).map(row => ({
        ...row,
        quarterly_effort: (row.quarterly_effort as Record<string, number>) || {}
      })) as PersonAssignment[];
    },
    staleTime: 1000 * 60,
    gcTime: 1000 * 60 * 5,
  });
}

// Fetch assignments for a specific person
export function usePersonAssignmentsByPerson(personId: string | undefined) {
  return useQuery({
    queryKey: ['person_assignments', personId],
    queryFn: async () => {
      if (!personId) return [];
      
      const { data, error } = await supabase
        .from('person_initiative_assignments')
        .select('*')
        .eq('person_id', personId);
      
      if (error) throw error;
      
      return (data || []).map(row => ({
        ...row,
        quarterly_effort: (row.quarterly_effort as Record<string, number>) || {}
      })) as PersonAssignment[];
    },
    enabled: !!personId,
    staleTime: 1000 * 60,
  });
}

// Mutations for assignments CRUD
export function useAssignmentMutations() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createAssignment = useMutation({
    mutationFn: async (assignment: Omit<PersonAssignment, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('person_initiative_assignments')
        .insert({
          person_id: assignment.person_id,
          initiative_id: assignment.initiative_id,
          quarterly_effort: assignment.quarterly_effort as unknown as Json
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['person_assignments'] });
      toast({ title: 'Привязка добавлена' });
    },
    onError: (error) => {
      toast({ title: 'Ошибка', description: error.message, variant: 'destructive' });
    }
  });

  const updateAssignment = useMutation({
    mutationFn: async ({ id, quarterly_effort }: { id: string; quarterly_effort: Record<string, number> }) => {
      const { data, error } = await supabase
        .from('person_initiative_assignments')
        .update({ quarterly_effort: quarterly_effort as unknown as Json })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['person_assignments'] });
    },
    onError: (error) => {
      toast({ title: 'Ошибка', description: error.message, variant: 'destructive' });
    }
  });

  const deleteAssignment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('person_initiative_assignments')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['person_assignments'] });
      toast({ title: 'Привязка удалена' });
    },
    onError: (error) => {
      toast({ title: 'Ошибка', description: error.message, variant: 'destructive' });
    }
  });

  return { createAssignment, updateAssignment, deleteAssignment };
}
