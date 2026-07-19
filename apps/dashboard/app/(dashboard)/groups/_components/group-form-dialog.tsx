"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { groupFormSchema, type GroupFormValues } from "@/lib/validation/users";
import { useCreateGroup } from "@/hooks/use-users";
import { ApiError } from "@/lib/api/errors";

interface GroupFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GroupFormDialog({ open, onOpenChange }: GroupFormDialogProps) {
  const createGroup = useCreateGroup();

  const form = useForm<GroupFormValues>({
    resolver: zodResolver(groupFormSchema),
    defaultValues: { name: "", description: "" },
  });

  function onSubmit(values: GroupFormValues) {
    createGroup.mutate(
      { name: values.name, description: values.description || null },
      {
        onSuccess: () => {
          toast.success("Gruppo creato");
          form.reset();
          onOpenChange(false);
        },
        onError: (error) => {
          toast.error(error instanceof ApiError ? error.detail : "Operazione non riuscita");
        },
      }
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nuovo gruppo</DialogTitle>
          <DialogDescription>I gruppi permettono di indirizzare le campagne a insiemi di utenti.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrizione</FormLabel>
                  <FormControl>
                    <Textarea rows={2} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Annulla
              </Button>
              <Button type="submit" disabled={createGroup.isPending}>
                {createGroup.isPending ? "Creazione..." : "Crea gruppo"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
