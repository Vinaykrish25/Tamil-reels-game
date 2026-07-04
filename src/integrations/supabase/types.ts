export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      assignments: {
        Row: {
          clue_hint: string | null;
          created_at: string;
          game_id: string;
          id: string;
          is_imposter: boolean;
          player_id: string;
          secret_text: string;
          user_id: string;
        };
        Insert: {
          clue_hint?: string | null;
          created_at?: string;
          game_id: string;
          id?: string;
          is_imposter: boolean;
          player_id: string;
          secret_text: string;
          user_id: string;
        };
        Update: {
          clue_hint?: string | null;
          created_at?: string;
          game_id?: string;
          id?: string;
          is_imposter?: boolean;
          player_id?: string;
          secret_text?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "assignments_game_id_fkey";
            columns: ["game_id"];
            isOneToOne: false;
            referencedRelation: "games";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assignments_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: false;
            referencedRelation: "players";
            referencedColumns: ["id"];
          },
        ];
      };
      chat_messages: {
        Row: {
          created_at: string;
          id: string;
          phase: Database["public"]["Enums"]["chat_phase"];
          player_id: string;
          room_id: string;
          text: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          phase?: Database["public"]["Enums"]["chat_phase"];
          player_id: string;
          room_id: string;
          text: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          phase?: Database["public"]["Enums"]["chat_phase"];
          player_id?: string;
          room_id?: string;
          text?: string;
        };
        Relationships: [
          {
            foreignKeyName: "chat_messages_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: false;
            referencedRelation: "players";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "chat_messages_room_id_fkey";
            columns: ["room_id"];
            isOneToOne: false;
            referencedRelation: "rooms";
            referencedColumns: ["id"];
          },
        ];
      };
      clues: {
        Row: {
          created_at: string;
          game_id: string;
          id: string;
          player_id: string;
          room_id: string;
          round: number;
          text: string;
        };
        Insert: {
          created_at?: string;
          game_id: string;
          id?: string;
          player_id: string;
          room_id: string;
          round: number;
          text: string;
        };
        Update: {
          created_at?: string;
          game_id?: string;
          id?: string;
          player_id?: string;
          room_id?: string;
          round?: number;
          text?: string;
        };
        Relationships: [
          {
            foreignKeyName: "clues_game_id_fkey";
            columns: ["game_id"];
            isOneToOne: false;
            referencedRelation: "games";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "clues_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: false;
            referencedRelation: "players";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "clues_room_id_fkey";
            columns: ["room_id"];
            isOneToOne: false;
            referencedRelation: "rooms";
            referencedColumns: ["id"];
          },
        ];
      };
      games: {
        Row: {
          ended_at: string | null;
          id: string;
          revealed_imposter_player_id: string | null;
          revealed_movie_id: string | null;
          room_id: string;
          started_at: string;
        };
        Insert: {
          ended_at?: string | null;
          id?: string;
          revealed_imposter_player_id?: string | null;
          revealed_movie_id?: string | null;
          room_id: string;
          started_at?: string;
        };
        Update: {
          ended_at?: string | null;
          id?: string;
          revealed_imposter_player_id?: string | null;
          revealed_movie_id?: string | null;
          room_id?: string;
          started_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "games_room_id_fkey";
            columns: ["room_id"];
            isOneToOne: false;
            referencedRelation: "rooms";
            referencedColumns: ["id"];
          },
        ];
      };
      movies: {
        Row: {
          clue: string;
          created_at: string;
          created_by: string | null;
          id: string;
          room_id: string | null;
          source: Database["public"]["Enums"]["movie_source"];
          title: string;
        };
        Insert: {
          clue: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          room_id?: string | null;
          source?: Database["public"]["Enums"]["movie_source"];
          title: string;
        };
        Update: {
          clue?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          room_id?: string | null;
          source?: Database["public"]["Enums"]["movie_source"];
          title?: string;
        };
        Relationships: [];
      };
      play_again: {
        Row: {
          created_at: string;
          game_id: string;
          id: string;
          player_id: string;
        };
        Insert: {
          created_at?: string;
          game_id: string;
          id?: string;
          player_id: string;
        };
        Update: {
          created_at?: string;
          game_id?: string;
          id?: string;
          player_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "play_again_game_id_fkey";
            columns: ["game_id"];
            isOneToOne: false;
            referencedRelation: "games";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "play_again_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: false;
            referencedRelation: "players";
            referencedColumns: ["id"];
          },
        ];
      };
      players: {
        Row: {
          avatar_seed: string;
          display_name: string;
          id: string;
          is_host: boolean;
          joined_at: string;
          kicked: boolean;
          last_seen_at: string;
          room_id: string;
          user_id: string;
        };
        Insert: {
          avatar_seed: string;
          display_name: string;
          id?: string;
          is_host?: boolean;
          joined_at?: string;
          kicked?: boolean;
          last_seen_at?: string;
          room_id: string;
          user_id: string;
        };
        Update: {
          avatar_seed?: string;
          display_name?: string;
          id?: string;
          is_host?: boolean;
          joined_at?: string;
          kicked?: boolean;
          last_seen_at?: string;
          room_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "players_room_id_fkey";
            columns: ["room_id"];
            isOneToOne: false;
            referencedRelation: "rooms";
            referencedColumns: ["id"];
          },
        ];
      };
      reactions: {
        Row: {
          created_at: string;
          emoji: string;
          id: string;
          player_id: string;
          room_id: string;
        };
        Insert: {
          created_at?: string;
          emoji: string;
          id?: string;
          player_id: string;
          room_id: string;
        };
        Update: {
          created_at?: string;
          emoji?: string;
          id?: string;
          player_id?: string;
          room_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reactions_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: false;
            referencedRelation: "players";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reactions_room_id_fkey";
            columns: ["room_id"];
            isOneToOne: false;
            referencedRelation: "rooms";
            referencedColumns: ["id"];
          },
        ];
      };
      rooms: {
        Row: {
          code: string;
          created_at: string;
          current_game_id: string | null;
          current_round: number;
          host_player_id: string | null;
          id: string;
          revealed: boolean;
          status: Database["public"]["Enums"]["room_status"];
          updated_at: string;
        };
        Insert: {
          code: string;
          created_at?: string;
          current_game_id?: string | null;
          current_round?: number;
          host_player_id?: string | null;
          id?: string;
          revealed?: boolean;
          status?: Database["public"]["Enums"]["room_status"];
          updated_at?: string;
        };
        Update: {
          code?: string;
          created_at?: string;
          current_game_id?: string | null;
          current_round?: number;
          host_player_id?: string | null;
          id?: string;
          revealed?: boolean;
          status?: Database["public"]["Enums"]["room_status"];
          updated_at?: string;
        };
        Relationships: [];
      };
      votes: {
        Row: {
          created_at: string;
          game_id: string;
          id: string;
          room_id: string;
          target_player_id: string;
          voter_player_id: string;
        };
        Insert: {
          created_at?: string;
          game_id: string;
          id?: string;
          room_id: string;
          target_player_id: string;
          voter_player_id: string;
        };
        Update: {
          created_at?: string;
          game_id?: string;
          id?: string;
          room_id?: string;
          target_player_id?: string;
          voter_player_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "votes_game_id_fkey";
            columns: ["game_id"];
            isOneToOne: false;
            referencedRelation: "games";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "votes_room_id_fkey";
            columns: ["room_id"];
            isOneToOne: false;
            referencedRelation: "rooms";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "votes_target_player_id_fkey";
            columns: ["target_player_id"];
            isOneToOne: false;
            referencedRelation: "players";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "votes_voter_player_id_fkey";
            columns: ["voter_player_id"];
            isOneToOne: false;
            referencedRelation: "players";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      chat_phase: "lobby" | "game" | "voting" | "postgame";
      movie_source: "builtin" | "custom";
      room_status: "lobby" | "clue" | "discussion" | "voting" | "results";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      chat_phase: ["lobby", "game", "voting", "postgame"],
      movie_source: ["builtin", "custom"],
      room_status: ["lobby", "clue", "discussion", "voting", "results"],
    },
  },
} as const;
