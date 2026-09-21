package net.filebot.backend.service;

import net.filebot.backend.dto.IntakeRequestDto;
import net.filebot.backend.dto.IntakeResultDto;

public interface AppShellService {

  IntakeResultDto processFileIntake(IntakeRequestDto request);
}
